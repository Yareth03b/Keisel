# 🚌 Keisel Mobility - Sistema de Rastreo de Buses Universitarios en Tiempo Real

Plataforma inteligente de monitoreo y telemetría GPS para el circuito de transporte universitario.

## 🚀 Arquitectura del Proyecto

- **Visor Web de Estudiantes:** Desarrollado con **Leaflet.js**, HTML5 y Tailwind CSS. Permite visualizar en tiempo real el recorrido y los paraderos de los buses del campus sin necesidad de instalar aplicaciones.
- **App Conductor (APK Android):** Desarrollada en **C# (.NET MAUI)** con captura de GPS satelital en alta precisión.
- **Base de Datos & WebSockets en Tiempo Real:** **Supabase (PostgreSQL + Realtime)** como puente de comunicación bidireccional entre la app móvil del conductor y la web estudiantil.

## 📍 Ubicación Oficial
- **Campus Universitario:** Latitud `-10.72635`, Longitud `-77.77373`.
- **Paradero Principal:** Salida del circuito universitario.

## 📂 Archivos Principales
- `index.html`: Portal de bienvenida para estudiantes.
- `mapa_estudiantes.html`: Mapa interactivo a pantalla completa con Leaflet, suscripción en vivo a Supabase y trazado dinámico de rutas.

## 🛠️ Tecnologías
- Leaflet.js
- OpenStreetMap
- Supabase Realtime (WebSockets)
- C# / .NET MAUI
- Tailwind CSS
