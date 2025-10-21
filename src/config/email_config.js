import nodemailer from 'nodemailer';

// It's highly recommended to use environment variables for sensitive data
const sender_email = process.env.SENDER_EMAIL;
const sender_password = process.env.SENDER_PASSWORD;

let transporter;
if (!sender_email || !sender_password) {
    console.warn('Email configuration is missing. Email features will be disabled. Please set SENDER_EMAIL and SENDER_PASSWORD in your .env file.');
} else {
    // Create a transporter object using SMTP transport.
    // You might need to configure this differently based on your email provider (e.g., Gmail, SendGrid, Outlook).
    transporter = nodemailer.createTransport({
      service: 'gmail', // Example with Gmail, change as needed
      auth: {
        user: sender_email,
        pass: sender_password,
      },
    });

    // Verify connection configuration
    transporter.verify(function (error, success) {
        if (error) {
            console.error('Error with email transporter configuration:', error);
        } else {
            console.log('Email server is ready to take our messages');
        }
    });
}

// Export the transporter to be used in other parts of the application
export default transporter;