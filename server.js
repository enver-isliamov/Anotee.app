import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Импорт API функций
import dataHandler from './api/data.js';
import uploadHandler from './api/upload.js';
import deleteHandler from './api/delete.js';
import commentHandler from './api/comment.js';
import paymentHandler from './api/payment.js';
import adminHandler from './api/admin.js';
import cronHandler from './api/cron.js';
import healthHandler from './api/health.js';
import driveTokenHandler from './api/driveToken.js';
import proxyAudioHandler from './api/proxyAudio.js';
import checkUpdatesHandler from './api/check-updates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Увеличение лимита для JSON (важно для base64 загрузок, если используются)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Раздача статики (Frontend) из папки dist
app.use(express.static(join(__dirname, 'dist')));

// Обертка для совместимости Vercel Serverless Functions с Express
const wrap = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (e) {
        console.error(e);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message || 'Internal Server Error' });
        }
    }
};

// Регистрация API маршрутов
app.all('/api/data', wrap(dataHandler));
app.all('/api/upload', wrap(uploadHandler));
app.all('/api/delete', wrap(deleteHandler));
app.all('/api/comment', wrap(commentHandler));
app.all('/api/payment', wrap(paymentHandler));
app.all('/api/admin', wrap(adminHandler));
app.all('/api/cron', wrap(cronHandler));
app.all('/api/health', wrap(healthHandler));
app.all('/api/driveToken', wrap(driveTokenHandler));
app.all('/api/proxyAudio', wrap(proxyAudioHandler));
app.all('/api/check-updates', wrap(checkUpdatesHandler));

// Любой другой запрос отправляем на index.html (для SPA роутинга React)
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});