// T-64: лёгкая шина тостов — позволяет показывать уведомления из любого компонента
// App подписывает шину на свой notify(); вне приложения сообщение уходит в console.warn.
type ToastType = 'info' | 'success' | 'error' | 'warning';
type Handler = (message: string, type?: ToastType) => void;
let handler: Handler | null = null;
export const setToastHandler = (h: Handler | null) => { handler = h; };
export const toast = (message: string, type: ToastType = 'info') => {
  if (handler) handler(message, type);
  else console.warn('[toast]', type, message);
};
