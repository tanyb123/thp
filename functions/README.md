# PDF Generation Cloud Function

This Firebase Cloud Function provides server-side PDF generation for invoices and quotations in the THP App. It uses Puppeteer to convert HTML into PDF documents which are then stored in Firebase Storage.

## Features

- Server-side PDF generation with Puppeteer
- HTML to PDF rendering with proper formatting and styling
- Automatic upload to Firebase Storage
- Returns public URLs for easy sharing

## Technical Implementation

The main Cloud Function `generateInvoicePDF` receives quotation data as a parameter and performs the following operations:

1. Validates and authenticates the request
2. Generates HTML content from the provided data
3. Creates a PDF using Puppeteer's headless browser
4. Uploads the PDF to Firebase Storage
5. Returns the public URL to the client

## Advantages Over Client-Side Generation

- Reliable PDF generation even on low-powered mobile devices
- Consistent formatting across all devices
- Reduced client-side processing load
- Better handling of complex layouts and large documents

## Deployment

Deploy the function using:

```bash
firebase deploy --only functions:generateInvoicePDF
```

## Usage from Client

Call the function from your React Native app:

```javascript
const functions = getFunctions();
const generateInvoicePDF = httpsCallable(functions, 'generateInvoicePDF');

const result = await generateInvoicePDF({ 
  userId, 
  quotationData 
});

const { pdfUrl } = result.data;
// Use pdfUrl to display or share the PDF
```

## Dependencies

- Firebase Admin SDK
- Firebase Functions
- Puppeteer for HTML to PDF conversion 