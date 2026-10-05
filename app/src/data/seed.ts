import { Product } from '../types';

// Invented example products with made-up barcodes, for development and tests.
export const seedProducts: Product[] = [
  {
    id: 'p1', barcode: '4600000000011', type: 'food', name: 'Овсяные хлопья цельнозерновые', brand: 'Полевой',
    category: 'cereal', organic: true,
    nutrition: { energyKcal: 370, sugarsG: 1, satFatG: 1.3, sodiumMg: 10, fiberG: 10, proteinG: 13 },
    ingredients: [{ name: 'Овёс цельнозерновой', risk: 'none' }], tags: ['vegetarian', 'vegan', 'gluten'],
  },
  {
    id: 'p2', barcode: '4600000000028', type: 'food', name: 'Мюсли с мёдом', brand: 'Полевой',
    category: 'cereal', organic: false,
    nutrition: { energyKcal: 390, sugarsG: 18, satFatG: 2, sodiumMg: 40, fiberG: 7, proteinG: 9 },
    ingredients: [{ name: 'Овёс', risk: 'none' }, { name: 'Мёд', risk: 'none' }, { name: 'Изюм', risk: 'none' }],
    tags: ['vegetarian', 'gluten'],
  },
  {
    id: 'p3', barcode: '4600000000035', type: 'food', name: 'Шоколадные подушечки', brand: 'Сладкий день',
    category: 'cereal', organic: false,
    nutrition: { energyKcal: 410, sugarsG: 32, satFatG: 6, sodiumMg: 300, fiberG: 3, proteinG: 6 },
    ingredients: [
      { name: 'Сахар', risk: 'low' }, { name: 'Пальмовое масло', risk: 'moderate' },
      { name: 'Красный краситель', risk: 'high', note: 'Есть данные о возможном вреде при регулярном употреблении.' },
    ],
    tags: ['vegetarian', 'palm_oil', 'gluten'],
  },
  {
    id: 'p4', barcode: '4600000000042', type: 'food', name: 'Йогурт натуральный', brand: 'Молочная ферма',
    category: 'yogurt', organic: false,
    nutrition: { energyKcal: 62, sugarsG: 4.5, satFatG: 2.2, sodiumMg: 45, fiberG: 0, proteinG: 4 },
    ingredients: [{ name: 'Молоко', risk: 'none' }, { name: 'Закваска', risk: 'none' }],
    tags: ['vegetarian', 'lactose'],
  },
  {
    id: 'p5', barcode: '4600000000059', type: 'food', name: 'Йогурт десертный с наполнителем', brand: 'Сладкий день',
    category: 'yogurt', organic: false,
    nutrition: { energyKcal: 125, sugarsG: 17, satFatG: 3.5, sodiumMg: 60, fiberG: 0, proteinG: 3 },
    ingredients: [
      { name: 'Молоко', risk: 'none' }, { name: 'Сахар', risk: 'low' },
      { name: 'Ароматизатор', risk: 'moderate' }, { name: 'Загуститель', risk: 'low' },
    ],
    tags: ['vegetarian', 'lactose'],
  },
  {
    id: 'p6', barcode: '4600000000066', type: 'food', name: 'Овсяный напиток', brand: 'Зелёный лист',
    category: 'drink', organic: true,
    nutrition: { energyKcal: 45, sugarsG: 3.5, satFatG: 0.2, sodiumMg: 40, fiberG: 0.8, proteinG: 1 },
    ingredients: [{ name: 'Овёс', risk: 'none' }, { name: 'Вода', risk: 'none' }],
    tags: ['vegetarian', 'vegan', 'gluten'],
  },
  {
    id: 'p7', barcode: '4600000000073', type: 'food', name: 'Газировка со вкусом колы', brand: 'Пузырь',
    category: 'drink', organic: false,
    nutrition: { energyKcal: 42, sugarsG: 10.6, satFatG: 0, sodiumMg: 10, fiberG: 0, proteinG: 0 },
    ingredients: [
      { name: 'Сахар', risk: 'low' }, { name: 'Краситель карамельный', risk: 'moderate' },
      { name: 'Ароматизатор', risk: 'moderate' },
    ],
    tags: ['vegetarian', 'vegan'],
  },
  {
    id: 'p8', barcode: '4600000000080', type: 'food', name: 'Фруктовые снеки с красителем', brand: 'Пузырь',
    category: 'snack', organic: true,
    nutrition: { energyKcal: 120, sugarsG: 4, satFatG: 0.5, sodiumMg: 20, fiberG: 6, proteinG: 8 },
    ingredients: [{ name: 'Фрукты', risk: 'none' }, { name: 'Красный краситель', risk: 'high', note: 'Есть данные о возможном вреде при регулярном употреблении.' }],
    tags: ['vegetarian', 'vegan'],
  },
  {
    id: 'c1', barcode: '4600000000102', type: 'cosmetic', name: 'Крем для рук с маслом ши', brand: 'Мягкая кожа',
    category: 'hand_cream', organic: false,
    ingredients: [
      { name: 'Масло ши', risk: 'none' }, { name: 'Глицерин', risk: 'none' }, { name: 'Токоферол', risk: 'none' },
    ],
    tags: [],
  },
  {
    id: 'c2', barcode: '4600000000119', type: 'cosmetic', name: 'Крем для рук ароматный', brand: 'Блеск',
    category: 'hand_cream', organic: false,
    ingredients: [
      { name: 'Парфюмерная композиция', risk: 'moderate' }, { name: 'Консервант', risk: 'high', note: 'Относится к веществам с высоким риском раздражения и аллергии.' },
      { name: 'Глицерин', risk: 'none' },
    ],
    tags: [],
  },
  {
    id: 'c3', barcode: '4600000000126', type: 'cosmetic', name: 'Шампунь мягкий', brand: 'Чистый лист',
    category: 'shampoo', organic: false,
    ingredients: [
      { name: 'Вода', risk: 'none' }, { name: 'Поверхностно-активное вещество мягкое', risk: 'low' },
      { name: 'Лимонная кислота', risk: 'none' },
    ],
    tags: [],
  },
];
