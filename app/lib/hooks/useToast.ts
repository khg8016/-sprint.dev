import { toast } from 'react-toastify';

interface ToastOptions {
  title: string;
  description: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function useToast() {
  return ({ title, description, type }: ToastOptions) => {
    const message = `${title}\n${description}`;
    const options = {
      position: 'bottom-right' as const,
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    switch (type) {
      case 'success':
        toast.success(message, options);
        break;
      case 'error':
        toast.error(message, options);
        break;
      case 'info':
        toast.info(message, options);
        break;
      case 'warning':
        toast.warning(message, options);
        break;
    }
  };
}
