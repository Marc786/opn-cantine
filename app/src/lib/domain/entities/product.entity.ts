export interface Product {
  id: string;
  barcodes: string[];
  name: string;
  price: number;
  quantity: number;
}

export class ProductEntity implements Product {
  constructor(
    public readonly id: string,
    public readonly barcodes: string[],
    public readonly name: string,
    public readonly price: number,
    public quantity: number
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (this.barcodes.length === 0) {
      throw new Error('At least one barcode is required');
    }

    if (this.price < 0) {
      throw new Error('Price must be >= 0');
    }

    if (this.quantity < 0) {
      throw new Error('Quantity must be >= 0');
    }
  }

  static create(
    barcodes: string[],
    name: string,
    price: number,
    quantity: number
  ): ProductEntity {
    return new ProductEntity(
      '',
      barcodes.map((b) => b.trim()),
      name.trim(),
      price,
      quantity
    );
  }
}
