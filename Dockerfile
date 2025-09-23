# Usa una imagen base de Node.js
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de package.json y package-lock.json
COPY package.json package-lock.json* ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos del proyecto
COPY . .

# Construye la aplicación
RUN npm run build

# Expone el puerto (ajústalo según tu app, ej. 3000 para Vite)
EXPOSE 3000

# Comando para servir la app (usa un servidor estático como serve)
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]
