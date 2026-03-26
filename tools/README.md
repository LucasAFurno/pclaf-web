# tools

Esta carpeta contiene archivos que la web publica y que deben quedar accesibles aunque los repos de GitHub sean privados.

## Archivo importante

- `DiagnosticoPC.ps1`: copia publicada del script fuente que vive en `pclaf-reporte`.

## Regla de mantenimiento

Si se modifica `pclaf-reporte/DiagnosticoPC.ps1`, hay que sincronizar tambien esta copia antes de desplegar la web.

La web administrativa descarga este archivo desde el propio sitio publicado para que el launcher siga funcionando sin depender de `raw.githubusercontent.com`.

