Sistema de Chat Distribuido v1.1 
Descripción: 
Este proyecto busca desarrollar un sistema de chat distribuido avanzado, que permita a los 
usuarios comunicarse en tiempo real mediante mensajes de texto y el intercambio de archivos 
multimedia, incluyendo texto, fotos, vídeos y audios. Este sistema integrará funcionalidades 
avanzadas para enriquecer la interacción de los usuarios y mejorar la gestión del contenido. 
Las características clave incluirán sincronización efectiva de mensajes, encriptación robusta 
para la seguridad de las comunicaciones, gestión avanzada de usuarios con autenticación y 
manejo de sesiones, y la programación de tareas como recordatorios y alertas, todo bajo un 
marco de sistemas distribuidos y gestión de procesos.

El sistema proporciona una interfaz de usuario adaptable y optimizada utilizando tecnologías HTML, JavaScript y CSS. Además WebSockets para la comunicación entre el servidor y los clientes en tiempo real.

Instalación: 
No se requiere de alguna instalación previa para ejecutar el sistema.

Guía de uso: 
Solamente se necesita abrir el vínculo(link) posteriormente, realizar el registro e inicio de sesión del nuevo usuario a utilizar. 


El sistema guarda los mensajes en una base de datos SQLite, la cual se encuentra al nivel del servidor. De ahí el WebSocket envía los mensajes al cliente donde se muestran a nivel de FrontEnd.

API: se implementó un API en Python con FLASK para la traducción de mensajes de cualquier idioma a inglés (Esto utilizando un bot conectado a una IA de GPT.4)

Contribuciones y Créditos
Autores:
Gerson Vargas Gamboa
Josseph Valverde Robles
Ovidio Martínez Taleno

Este proyecto ha utilizado las siguientes tecnologías y recursos:
[WebSocket] - Comunicación en tiempo real
[Node.js] - Entorno de ejecución para JavaScript en el server
[HTML-CSS] - A nivel de diseño gráfico
[JavaScript] - Nivel backend 
[Python-FLASK] - API del bot 
