import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://idnpricbfgiwzifwlwii.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbnByaWNiZmdpd3ppZndsd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjU0MDgsImV4cCI6MjA5MjQ0MTQwOH0.FItNI4jDuwShdpJGAOXnebMFO7Wd5RqsJp7gP7ZhMy4";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedData() {
  console.log('Inaanza kuingiza data za Letema Group...');

  try {
    // 1. Ingiza Makundi (Categories) ya majaribio
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .insert([
        { name: 'Vifaa vya Shule & Ofisi' },
        { name: 'Huduma za Mtandao (Café)' },
        { name: 'Uchapishaji na Copy' }
      ])
      .select();

    if (catError) throw catError;
    console.log('✓ Makundi yameingizwa kwa mafanikio!');

    const shuleCatId = catData[0].id;
    const cafeCatId = catData[1].id;
    const printCatId = catData[2].id;

    // 2. Ingiza Bidhaa na Huduma (Products & Services)
    const { error: prodError } = await supabase
      .from('products')
      .insert([
        {
          name: 'Daftari Kubwa (Counter Book A4)',
          description: 'Daftari ngumu kurasa 200 kwa ajili ya masomo au kumbukumbu za ofisi.',
          price: 3500,
          type: 'stationery',
          stock_quantity: 50,
          is_available: true,
          category_id: shuleCatId
        },
        {
          name: 'Kalamu ya Bic (Box la Vipande 50)',
          description: 'Kalamu bora za wino wa bluu zinazodumu kwa muda mrefu.',
          price: 15000,
          type: 'stationery',
          stock_quantity: 10,
          is_available: true,
          category_id: shuleCatId
        },
        {
          name: 'Muda wa Internet (Saa 1)',
          description: 'Kasi kubwa ya intaneti (High-speed browsing) kwenye kompyuta zetu za kisasa.',
          price: 1000,
          type: 'service',
          stock_quantity: 999, // Huduma haina kikomo cha stoku ya kawaida
          is_available: true,
          category_id: cafeCatId
        },
        {
          name: 'Kutoa Copy (Black & White - Ukurasa 1)',
          description: 'Huduma ya haraka ya kutoa nakala kwa kutumia karatasi safi za A4.',
          price: 100,
          type: 'service',
          stock_quantity: 999,
          is_available: true,
          category_id: printCatId
        }
      ]);

    if (prodError) throw prodError;
    console.log('✓ Bidhaa na Huduma zote zimeingizwa kwenye duka kwa mafanikio!');

  } catch (err) {
    console.error('Hitilafu wakati wa kuingiza data:', err.message);
  }
}

seedData();

