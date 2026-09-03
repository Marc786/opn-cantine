import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
const m = await MongoMemoryServer.create();
const uri = m.getUri();
const c = new MongoClient(uri); await c.connect();
const db = c.db('smoke');
await db.collection('products').insertMany([
  { name:'Chips BBQ format familial', barcode:'0064420001030', price:2.5, quantity:10 },
  { name:'Jus de pomme', barcode:'0064420001047', price:1.25, quantity:10 },
  { name:'Barre tendre', barcode:'0064420001054', price:1.75, quantity:10 },
]);
await db.collection('employees').insertMany([
  { employeeNumber:'E1', cardNumber:'CARD1', tab:0 },
  { employeeNumber:'EMPLOYE-123', cardNumber:'CARD2', tab:123.45 },
]);
await c.close();
console.log('URI=' + uri);
await new Promise(() => {});
