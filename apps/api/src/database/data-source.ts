import '../config/load-dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { typeormOptions } from './typeorm-options';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');

export default new DataSource(typeormOptions(url));
