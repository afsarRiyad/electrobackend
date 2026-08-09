// Payment Service for bKash and Nagad integration
import axios from 'axios';

// Configuration - Move these to environment variables
const BKASH_CONFIG = {
  sandbox: process.env.BKASH_SANDBOX === 'true',
  username: process.env.BKASH_USERNAME,
  password: process.env.BKASH_PASSWORD,
  appKey: process.env.BKASH_APP_KEY,
  appSecret: process.env.BKASH_APP_SECRET,
  merchantID: process.env.BKASH_MERCHANT_ID,
};

const NAGAD_CONFIG = {
  sandbox: process.env.NAGAD_SANDBOX === 'true',
  merchantID: process.env.NAGAD_MERCHANT_ID,
  merchantAccount: process.env.NAGAD_MERCHANT_ACCOUNT,
  username: process.env.NAGAD_USERNAME,
  password: process.env.NAGAD_PASSWORD,
  publicKey: process.env.NAGAD_PUBLIC_KEY,
  privateKey: process.env.NAGAD_PRIVATE_KEY,
};

// bKash API URLs
const BKASH_URLS = {
  sandbox: {
    grantToken: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/grant-token',
    createPayment: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create',
    executePayment: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/execute',
    queryPayment: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/payment/status',
  },
  live: {
    grantToken: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/grant-token',
    createPayment: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/create',
    executePayment: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/execute',
    queryPayment: 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/payment/status',
  }
};

// Nagad API URLs
const NAGAD_URLS = {
  sandbox: 'https://sandbox.nagad.com:2443/remote/payment/get/',
  live: 'https://api.mynagad.com/remote/payment/get/',
};

class PaymentService {
  // bKash Token Generation
  static async getBkashToken() {
    try {
      const url = BKASH_CONFIG.sandbox ? BKASH_URLS.sandbox.grantToken : BKASH_URLS.live.grantToken;
      
      const response = await axios.post(url, {
        app_key: BKASH_CONFIG.appKey,
        app_secret: BKASH_CONFIG.appSecret,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'username': BKASH_CONFIG.username,
          'password': BKASH_CONFIG.password,
        }
      });

      return response.data.id_token;
    } catch (error) {
      console.error('bKash token generation failed:', error);
      throw new Error('Failed to generate bKash token');
    }
  }

  // bKash Create Payment
  static async createBkashPayment(amount, orderDetails) {
    try {
      const token = await this.getBkashToken();
      const url = BKASH_CONFIG.sandbox ? BKASH_URLS.sandbox.createPayment : BKASH_URLS.live.createPayment;

      const response = await axios.post(url, {
        mode: '0011',
        payerReference: orderDetails.customerEmail,
        callbackURL: `${process.env.CLIENT_URL}/payment/bkash/callback`,
        amount: amount,
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: orderDetails.orderNumber,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': BKASH_CONFIG.appKey,
        }
      });

      return {
        success: true,
        paymentID: response.data.paymentID,
        bkashURL: response.data.bkashURL,
      };
    } catch (error) {
      console.error('bKash payment creation failed:', error);
      throw new Error('Failed to create bKash payment');
    }
  }

  // bKash Execute Payment
  static async executeBkashPayment(paymentID) {
    try {
      const token = await this.getBkashToken();
      const url = BKASH_CONFIG.sandbox ? BKASH_URLS.sandbox.executePayment : BKASH_URLS.live.executePayment;

      const response = await axios.post(url, {
        paymentID: paymentID,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': BKASH_CONFIG.appKey,
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash payment execution failed:', error);
      throw new Error('Failed to execute bKash payment');
    }
  }

  // bKash Query Payment Status
  static async queryBkashPayment(paymentID) {
    try {
      const token = await this.getBkashToken();
      const url = BKASH_CONFIG.sandbox ? BKASH_URLS.sandbox.queryPayment : BKASH_URLS.live.queryPayment;

      const response = await axios.post(url, {
        paymentID: paymentID,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': token,
          'X-APP-Key': BKASH_CONFIG.appKey,
        }
      });

      return response.data;
    } catch (error) {
      console.error('bKash payment query failed:', error);
      throw new Error('Failed to query bKash payment status');
    }
  }

  // Nagad Create Payment
  static async createNagadPayment(amount, orderDetails) {
    try {
      const url = NAGAD_CONFIG.sandbox ? NAGAD_URLS.sandbox : NAGAD_URLS.live;
      
      const payload = {
        accountNumber: NAGAD_CONFIG.merchantAccount,
        amount: amount,
        currencyCode: 'BDT',
        merchantId: NAGAD_CONFIG.merchantID,
        merchantReference: orderDetails.orderNumber,
        callbackURL: `${process.env.CLIENT_URL}/payment/nagad/callback`,
        details: {
          orderId: orderDetails.orderNumber,
          customerName: orderDetails.customerName,
          customerEmail: orderDetails.customerEmail,
        }
      };

      // Sign the payload with private key (implementation depends on Nagad's specific signing method)
      const signature = this.signNagadPayload(payload, NAGAD_CONFIG.privateKey);

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-KM-IP-V4': '127.0.0.1', // Your server IP
          'X-KM-Signature': signature,
          'X-KM-Timestamp': Date.now(),
          'X-KM-Api-Version': 'v-1.0',
        }
      });

      return {
        success: true,
        paymentID: response.data.paymentID,
        nagadURL: response.data.url,
      };
    } catch (error) {
      console.error('Nagad payment creation failed:', error);
      throw new Error('Failed to create Nagad payment');
    }
  }

  // Nagad Payment Signature (Implementation depends on Nagad's specific requirements)
  static signNagadPayload(payload, privateKey) {
    // This is a placeholder - actual implementation depends on Nagad's signing algorithm
    // Typically involves HMAC-SHA256 or similar
    return 'signature_placeholder';
  }

  // Verify Nagad Payment
  static async verifyNagadPayment(paymentID) {
    try {
      const url = NAGAD_CONFIG.sandbox ? NAGAD_URLS.sandbox : NAGAD_URLS.live;
      
      const response = await axios.get(`${url}${paymentID}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-KM-Api-Version': 'v-1.0',
        }
      });

      return response.data;
    } catch (error) {
      console.error('Nagad payment verification failed:', error);
      throw new Error('Failed to verify Nagad payment');
    }
  }
}

export default PaymentService;
