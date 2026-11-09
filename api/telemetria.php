<?php
/**
 * ============================================================================
 * PROYECTO KEISEL - API REST DE TELEMETRÍA Y AUTENTICACIÓN LOCAL
 * Servidor Web RHEL (192.168.1.252) -> SQL Server (192.168.1.254:1433)
 * ============================================================================
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Responder inmediatamente a solicitudes pre-flight OPTIONS de navegadores
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Parámetros de conexión a SQL Server (Variables de entorno o configuración protegida)
$db_host = getenv('DB_HOST') ?: '100.86.248.110';
$db_port = getenv('DB_PORT') ?: '1433';
$db_name = getenv('DB_NAME') ?: 'KeiselDB';
$db_user = getenv('DB_USER') ?: 'keisel_rhel';
$db_pass = getenv('DB_PASS') ?: '';

// Soporte para archivo de configuración local excluido del repositorio público
if (file_exists(__DIR__ . '/config.local.php')) {
    include __DIR__ . '/config.local.php';
}

// Conexión PDO con soporte híbrido (sqlsrv oficial o dblib/FreeTDS)
try {
    if (extension_loaded('pdo_sqlsrv')) {
        $dsn = "sqlsrv:Server={$db_host},{$db_port};Database={$db_name};TrustServerCertificate=true";
        $pdo = new PDO($dsn, $db_user, $db_pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    } elseif (extension_loaded('pdo_dblib')) {
        $dsn = "dblib:host={$db_host}:{$db_port};dbname={$db_name}";
        $pdo = new PDO($dsn, $db_user, $db_pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    } else {
        throw new Exception("No se encontró el controlador de base de datos (pdo_sqlsrv o pdo_dblib). Instale php-sqlsrv o php-pdo-dblib en RHEL.");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Error de conexión a SQL Server: ' . $e->getMessage()
    ]);
    exit();
}

// Obtener método HTTP y cuerpo JSON de la petición
$metodo = $_SERVER['REQUEST_METHOD'];
$entradaRaw = file_get_contents('php://input');
$datos = json_decode($entradaRaw, true) ?? [];
$accion = $_GET['action'] ?? ($datos['action'] ?? '');

try {
    // ------------------------------------------------------------------------
    // 1. INICIO DE SESIÓN CENTRALIZADO (RBAC: ADMIN / CONDUCTOR)
    // ------------------------------------------------------------------------
    if ($accion === 'login' && $metodo === 'POST') {
        $usuario = trim($datos['usuario'] ?? '');
        $clave = trim($datos['contrasena'] ?? '');

        if (empty($usuario) || empty($clave)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'mensaje' => 'Falta ingresar usuario o contraseña']);
            exit();
        }

        $stmt = $pdo->prepare("EXEC dbo.sp_LoginUsuario @usuario_correo = :usuario, @contrasena = :clave");
        $stmt->execute([':usuario' => $usuario, ':clave' => $clave]);
        $fila = $stmt->fetch();

        if ($fila) {
            echo json_encode([
                'status' => 'success',
                'usuario' => [
                    'id' => (int)$fila['usuario_id'],
                    'correo' => $fila['usuario_correo'],
                    'rol' => $fila['rol'],
                    'nombre' => $fila['nombre_completo'],
                    'dni' => $fila['dni'],
                    'ruta' => $fila['ruta_asignada'],
                    'placa' => $fila['placa_unidad'],
                    'busId' => $fila['bus_rastreo_id']
                ]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'mensaje' => 'Credenciales inválidas o usuario inactivo']);
        }
        exit();
    }

    // ------------------------------------------------------------------------
    // 2. ACTUALIZAR GPS (TELEMETRÍA ENVIADA POR EL CONDUCTOR)
    // ------------------------------------------------------------------------
    if ($accion === 'actualizar_gps' && $metodo === 'POST') {
        $id = $datos['id'] ?? 'bus_keisel_1';
        $latitud = isset($datos['latitud']) ? (float)$datos['latitud'] : null;
        $longitud = isset($datos['longitud']) ? (float)$datos['longitud'] : null;

        $stmt = $pdo->prepare("EXEC dbo.sp_ActualizarGpsConductor @id = :id, @latitud = :lat, @longitud = :lng");
        $stmt->execute([
            ':id' => $id,
            ':lat' => $latitud,
            ':lng' => $longitud
        ]);

        echo json_encode([
            'status' => 'success',
            'mensaje' => 'Coordenadas actualizadas correctamente',
            'bus' => $id
        ]);
        exit();
    }

    // ------------------------------------------------------------------------
    // 3. CONSULTAR GPS EN TIEMPO REAL (MAPA DE ESTUDIANTES)
    // ------------------------------------------------------------------------
    if (($accion === 'obtener_gps' || $accion === '') && $metodo === 'GET') {
        $busesIds = ['bus_keisel_1', 'bus_keisel_2', 'bus_keisel_3'];
        $resultado = [];

        // Si se pide un bus específico
        if (!empty($_GET['id'])) {
            $busesIds = [$_GET['id']];
        }

        foreach ($busesIds as $busId) {
            $stmt = $pdo->prepare("EXEC dbo.sp_ObtenerGpsTiempoReal @id = :id");
            $stmt->execute([':id' => $busId]);
            $fila = $stmt->fetch();
            if ($fila) {
                $resultado[] = [
                    'id' => $fila['id'],
                    'conductor' => $fila['conductor'],
                    'ruta' => $fila['ruta_asignada'],
                    'placa' => $fila['placa_unidad'],
                    'latitud' => $fila['latitud'] !== null ? (float)$fila['latitud'] : null,
                    'longitud' => $fila['longitud'] !== null ? (float)$fila['longitud'] : null,
                    'actualizado_en' => $fila['actualizado_en']
                ];
            }
        }

        echo json_encode($resultado);
        exit();
    }

    // ------------------------------------------------------------------------
    // 4. CORTE DE EMERGENCIA (PANEL ADMINISTRADOR)
    // ------------------------------------------------------------------------
    if ($accion === 'corte_emergencia' && $metodo === 'POST') {
        $id = $datos['id'] ?? '';
        if (empty($id)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'mensaje' => 'Debe indicar el identificador del bus']);
            exit();
        }

        $stmt = $pdo->prepare("EXEC dbo.sp_CorteEmergenciaBus @id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode([
            'status' => 'success',
            'mensaje' => 'Señal cortada exitosamente para la unidad ' . $id
        ]);
        exit();
    }

    // Acción no reconocida
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Acción no válida o no especificada'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Error en la ejecución de la consulta: ' . $e->getMessage()
    ]);
}
