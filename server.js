const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const port = 3000;

// Simple hardcoded data for the invoice
const invoiceData = {
  sender: {
    name: "Your Company",
    address: "123 Business St.",
    city: "Cityville",
    country: "Countryland",
    zipCode: "12345",
    email: "contact@yourcompany.com",
    phone: "+123456789",
  },
  receiver: {
    name: "Customer Name",
    address: "456 Customer Rd.",
    city: "Customer City",
    country: "Customer Country",
    zipCode: "67890",
  },
  details: {
    invoiceNumber: "INV12345",
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      { name: "Product A", description: "Description A", quantity: 2, unitPrice: 50, total: 100 },
      { name: "Product B", description: "Description B", quantity: 1, unitPrice: 150, total: 150 },
    ],
    subTotal: 250,
    currency: "USD",
    totalAmount: 250,
    paymentTerms: "Due within 30 days",
    additionalNotes: "Thank you for your business!",
  },
};

app.get("/test",async (req,res)=>{
    console.log("Hello");
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto('https://developer.chrome.com/');

    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    // Type into search box.
    await page.locator('.devsite-search-field').fill('automate beyond recorder');

    // Wait and click on first result.
    await page.locator('.devsite-result-item-link').click();

    // Locate the full title with a unique string.
    const textSelector = await page
    .locator('text/Customize and automate')
    .waitHandle();
    const fullTitle = await textSelector?.evaluate(el => el.textContent);

    // Print the full title.
    console.log('The title of this blog post is "%s".', fullTitle);

    await browser.close();
})

app.get("/generate-invoice", async (req, res) => {
  // Launch Puppeteer to render the invoice PDF
  let browser;
  try {
    browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
  
      const page = await browser.newPage();
  
      // Log console and page errors for debugging
      page.on('console', (msg) => {
        console.log('Page console message:', msg.text());
      });
  
      page.on('error', (error) => {
        console.error('Page error:', error);
      });
  
      page.on('pageerror', (error) => {
        console.error('Page error event:', error);
      });
  
      const html =await generateInvoiceHtml(invoiceData);
  
      await page.setContent(html);
      console.log("After set content!");
  
      // Wait for the body to load completely
      await page.waitForSelector('body');  // This ensures the body is loaded before proceeding
  
      // Add external Tailwind CSS
      await page.addStyleTag({ url: "https://cdn.jsdelivr.net/npm/tailwindcss@2.0.3/dist/tailwind.min.css" });
  
      // Wait for a short delay to ensure styles are applied properly (if needed)
    //   await page.waitForTimeout(1000);  // Wait for 1 second to make sure the styles are applied
  
      // Generate PDF
      const pdf = await page.pdf({ format: "A4", printBackground: true });

      console.log(pdf);
      
  
      // Optionally save the PDF to file for debugging
      const fs = require('fs');
      fs.writeFileSync('invoice.pdf', pdf);
      console.log('PDF saved to invoice.pdf');
  
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=invoice.pdf");

      res.send(pdf);

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating invoice PDF.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
// Helper function to generate the invoice HTML
async function generateInvoiceHtml(data) {
    // Generate a QR code as a data URL
    const qrData = `Invoice ID: ${invoiceData.details.invoiceNumber}\nTotal Amount: ${invoiceData.details.subTotal.toFixed(2)} ${invoiceData.details.currency}\nDate: ${new Date(
        invoiceData.details.invoiceDate
    ).toLocaleDateString()}`;
    const qrCodeUrl = await QRCode.toDataURL(qrData);
    // const qrCodeUrl = await QRCode.toDataURL(`https://paymentlink.com/pay/${data.details.invoiceNumber}`);
  
    return `
      <html>
        <head>
          <title>Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; }
          </style>
        </head>
        <body class="p-6">
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-xl font-semibold text-blue-600">${data.sender.name}</h1>
              <p>${data.sender.address}</p>
              <p>${data.sender.city}, ${data.sender.zipCode}</p>
              <p>${data.sender.country}</p>
              <p>${data.sender.email}</p>
              <p>${data.sender.phone}</p>
            </div>
            <div class="text-right">
              <h2 class="text-3xl font-semibold text-gray-800">Invoice #${data.details.invoiceNumber}</h2>
              <p class="text-gray-600">Date: ${new Date(data.details.invoiceDate).toLocaleDateString()}</p>
              <p class="text-gray-600">Due Date: ${new Date(data.details.dueDate).toLocaleDateString()}</p>
            </div>
          </div>
  
          <div class="flex justify-between w-full mt-6">
  <!-- Bill To Section -->
  <div class="flex-1">
    <h3 class="font-semibold text-gray-800">Bill To:</h3>
    <p>${data.receiver.name}</p>
    <p>${data.receiver.address}</p>
    <p>${data.receiver.city}, ${data.receiver.zipCode}</p>
    <p>${data.receiver.country}</p>
  </div>

  <!-- QR Code Section -->
  <div class="flex justify-center items-center ml-6">
    <img src="${qrCodeUrl}" alt="QR Code for Payment" class="max-w-xs" />
  </div>
</div>

          <div class="mt-6">
            <table class="table-auto w-full border-collapse">
              <thead>
                <tr>
                  <th class="border p-2">Item</th>
                  <th class="border p-2">Qty</th>
                  <th class="border p-2">Rate</th>
                  <th class="border p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.details.items.map(item => `
                  <tr>
                    <td class="border p-2">${item.name}</td>
                    <td class="border p-2">${item.quantity}</td>
                    <td class="border p-2">${item.unitPrice} ${data.details.currency}</td>
                    <td class="border p-2">${item.total} ${data.details.currency}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
  
          <div class="mt-6">
            <p class="font-semibold text-gray-800">Subtotal: ${data.details.subTotal} ${data.details.currency}</p>
            <p class="font-semibold text-gray-800">Total: ${data.details.totalAmount} ${data.details.currency}</p>
          </div>
  
          <div class="mt-6">
            <p class="font-semibold text-gray-800">Payment Terms: ${data.details.paymentTerms}</p>
            <p class="text-gray-600">${data.details.additionalNotes}</p>
          </div>
  
          
        </body>
      </html>
    `;
  }