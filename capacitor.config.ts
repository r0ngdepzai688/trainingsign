
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iqc.training.pro',
  appName: 'IQC Training Pro',
  webDir: '.',
  bundledWebRuntime: false,
  server: {
    // Cho phép truy cập vào Firebase và các domain bên ngoài
    allowNavigation: [
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.gstatic.com'
    ]
  }
};

export default config;
