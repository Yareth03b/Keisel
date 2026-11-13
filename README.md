# Keisel Mobility - Sistema de Telemetria y Rastreo Vehicular Universitario

Plataforma integral de monitoreo geoespacial en tiempo real, gestion de flota y control de telemetria vehicular para el circuito de transporte universitario.

El sistema implementa una arquitectura hibrida desacoplada, integrando servicios de directorio corporativo, almacenamiento relacional, proxy inverso y clientes multiplataforma (Web y Android nativo).

---

## 1. Arquitectura del Sistema

La solucion sigue un modelo distribuido por capas con separacion de responsabilidades (SoC):

### 1.1 Capa de Identidad y Control de Acceso (IAM)
- **Servidor:** Controlador de Dominio Windows Server.
- **Servicio:** Active Directory Domain Services (AD DS) sobre protocolo LDAPv3.
- **Funcion:** Autenticacion centralizada de usuarios institucionales y autorizacion basada en roles (RBAC) mediante grupos de seguridad (`Conductores` y `Administradores`).

### 1.2 Capa de Datos Transaccionales (DBMS)
- **Servidor:** Microsoft SQL Server.
- **Instancia:** Base de datos relacional para gestion operativa y logistica.
- **Funcion:** Registro transaccional de telemetria (`dbo.rastreo`), mapeo operativo de unidades (`dbo.usuarios_app`) y logica de vigencia temporal de coordenadas mediante procedimientos almacenados optimizados.

### 1.3 Capa de Aplicacion y Enrutamiento (API & Gateway)
- **Servidor:** Red Hat Enterprise Linux (RHEL).
- **Web Server / Reverse Proxy:** Apache HTTP Server (`httpd`), responsable de la terminacion segura SSL/TLS y delegacion de rutas hacia los microservicios internos.
- **API Backend:** Servicio Node.js / Express administrado bajo `systemd`. Centraliza la validacion LDAP hacia el Directorio Activo y la persistencia de datos en SQL Server.

### 1.4 Capa de Red y Resiliencia
- **Red Local (LAN):** Segmento de red institucional dedicado para comunicacion entre nodos de servidores.
- **Enlace de Respaldo:** Red privada virtual punto a punto (Mesh VPN) mediante protocolo WireGuard para contingencia y administracion remota.
- **Acceso Externo:** Tunel seguro saliente mediante Cloudflare Zero Trust, permitiendo acceso HTTPS publico para estudiantes sin exposicion de puertos en el gateway perimetral.

---

## 2. Componentes de Software

### 2.1 Aplicacion Movil del Conductor (Android)
- **Entorno:** C# / .NET MAUI (`net10.0-android`).
- **Arquitectura:** Servicio en segundo plano persistente (`Android Foreground Service`) con notificacion de sistema activa para evitar suspension energetica del sistema operativo.
- **Telemetria:** Captura de senal GPS con tolerancia a fallos en interiores, inicializacion de coordenadas de respaldo y reconexion automatica multi-endpoint.

### 2.2 Portal Web de Estudiantes y Administracion
- **Visor Estudiantil:** Mapa interactivo basado en Leaflet.js sobre OpenStreetMap, con renderizado fluido de unidades en ruta, calculo de distancias y tiempo estimado de llegada (ETA).
- **Panel Administrativo:** Consola de monitoreo para control de unidades en transito y activacion de cortes de senal de emergencia ante incidentes.
- **Motor Grafico:** Lienzo nativo HTML5 Canvas 2D (`stardust.js`) optimizado para interfaces de acceso con minimo consumo de GPU.

---

## 3. Estructura del Repositorio

```
DESARROLLO/
├── Aplicacion movil/
│   └── KruskalConductor/             # Codigo fuente de la app conductor (.NET MAUI / C#)
├── Pagina web/
│   ├── css/
│   │   └── styles.css                # Estilos visuales modulares y animaciones de mapa
│   ├── js/
│   │   └── app.js                    # Logica de aplicacion, polling de telemetria y Leaflet
│   ├── assets/                       # Librerias locales (Leaflet, Stardust, iconos)
│   ├── index.html                    # Portal de bienvenida y navegacion
│   ├── mapa_estudiantes.html         # Vista directa para alumnos
│   └── site.webmanifest              # Configuracion PWA para navegadores moviles
└── Servidor API RHEL/
    ├── server.js                     # Controlador de la API, enlaces LDAP y consultas SQL
    └── package.json                  # Dependencias del runtime Node.js
```

---

## 4. Pila Tecnologica

| Capa | Tecnologia | Protocolo / Funcion |
| :--- | :--- | :--- |
| **Identidad** | Active Directory (AD DS) | LDAPv3 (Puerto 389) |
| **Persistencia** | Microsoft SQL Server | TDS Protocol (Puerto 1433) |
| **Servidor Host** | Red Hat Enterprise Linux (RHEL) | Administracion systemd |
| **Servidor Web** | Apache HTTP Server | Reverse Proxy / Terminacion SSL |
| **API Backend** | Node.js / Express | Servicios RESTful JSON |
| **Frontend** | HTML5, CSS3, JavaScript | Leaflet.js / Canvas 2D |
| **Cliente Conductor** | .NET MAUI (C#) | Foreground Service Android |
| **Tunel Cifrado** | Cloudflare Zero Trust | Conectividad segura saliente |

---

## 5. Administracion y Despliegue

### Despliegue de Cambios en Servidor Web (RHEL)
```bash
cd /var/www/html
sudo git pull origin main
```

### Control del Servicio Backend (Systemd)
```bash
# Reinicio del servicio de telemetria
sudo systemctl restart keisel-api

# Monitoreo de logs en tiempo real
sudo journalctl -u keisel-api -f
```

### Compilacion del Cliente Movil (Release)
```bash
cd "DESARROLLO/Mobile_Build/KruskalConductor"
dotnet publish -f net10.0-android -c Release
```
