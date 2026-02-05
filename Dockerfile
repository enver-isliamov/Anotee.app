# Используем Node.js
FROM node:18-alpine

# Рабочая папка
WORKDIR /app

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости (включая Express для запуска сервера)
RUN npm install
RUN npm install express

# Копируем весь проект
COPY . .

# Собираем React (Frontend)
RUN npm run build

# Открываем порт
EXPOSE 3000

# Запускаем наш адаптер
CMD ["node", "server.js"]