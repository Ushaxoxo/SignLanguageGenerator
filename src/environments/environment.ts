export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyAtVDGmDVCwWunWW2ocgeHWnAsUhHuXvcg',
    authDomain: 'sign-mt.firebaseapp.com',
    projectId: 'sign-mt',
    storageBucket: 'sign-mt.appspot.com',
    messagingSenderId: '665830225099',
    appId: '1:665830225099:web:18e0669d5847a4b047974e',
    measurementId: null,
  },
  reCAPTCHAKey: '6Ldsxb8oAAAAAGyUZbyd0QruivPSudqAWFygR-4t',
  azure: {
    speech: {
      subscriptionKey: 'ivuhYKGLYthphnUwGu55rlDPTWFnCYQwuSfMY5frOwxZg8FlxPVVJQQJ99BCACYeBjFXJ3w3AAAAACOGCUZS',
      region: 'eastus', // Example: 'eastus'
    },
    textAnalytics: {
      endpoint: 'https://ushatalking.cognitiveservices.azure.com/', // Text Analytics endpoint
      key: 'ivuhYKGLYthphnUwGu55rlDPTWFnCYQwuSfMY5frOwxZg8FlxPVVJQQJ99BCACYeBjFXJ3w3AAAAACOGCUZS', // Same key as speech service
    },
  },
};
