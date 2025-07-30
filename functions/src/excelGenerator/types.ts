/**
 * Interface for Excel formatted quotation data
 */
export interface ExcelQuotationData {
  metadata: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    taxCode: string;
    customerName: string;
    customerAddress: string;
    quotationNumber: string;
    quotationDate: string;
    projectName: string;
    quoteValidity: string;
  };
  materials: Array<{
    no: number;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  summary: {
    subTotal: number;
    discountPercentage: number;
    discountAmount: number;
    vatPercentage: number;
    vatAmount: number;
    grandTotal: number;
    amountInWords: string;
  };
}
