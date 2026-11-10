@echo off
rem Copia el registro del bot (Home Assistant: /media/registro_ofertas.txt) a registro\ofertas.txt.
rem Uso: bajar-registro.bat [host]   (por defecto homeassistant.local; puedes pasar la IP)
setlocal
cd /d "%~dp0"
set "HOST=%~1"
if "%HOST%"=="" set "HOST=homeassistant.local"
if not exist "registro" mkdir "registro"
if not exist "\\%HOST%\media\registro_ofertas.txt" (
  echo No encuentro \\%HOST%\media\registro_ofertas.txt
  echo - Si el bot aun no ha leido ningun correo, el archivo todavia no existe.
  echo - Si no ves la carpeta media en \\%HOST%, activala en el complemento Samba share.
  echo - Si Windows no encuentra %HOST%, prueba con la IP: bajar-registro.bat 192.168.1.10
  goto :fin
)
copy /y "\\%HOST%\media\registro_ofertas.txt" "registro\ofertas.txt" >nul
echo Registro copiado en registro\ofertas.txt
:fin
pause
