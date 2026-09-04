const WEB3FORMS_KEY = '190a5277-7e2b-48ef-94f4-971629cc804e';

export async function sendOrderEmailToAdmin({ customerName, phone, paymentMethod, items, totalAmount }) {
  const itemsList = items
    .map(i => `${i.name} (x${i.quantity || 1}) - ${(i.price * (i.quantity || 1)).toLocaleString()} TZS`)
    .join('\n');

  const formData = new FormData();
  formData.append('access_key', WEB3FORMS_KEY);
  formData.append('subject', `Oda Mpya - ${customerName} - ${totalAmount.toLocaleString()} TZS`);
  formData.append('from_name', 'LSIC Order System');
  formData.append('Mteja', customerName);
  formData.append('Simu', phone);
  formData.append('Malipo', paymentMethod);
  formData.append('Bidhaa', itemsList);
  formData.append('Jumla', `${totalAmount.toLocaleString()} TZS`);

  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    body: formData,
  });

  const result = await res.json();
  if (!result.success) throw new Error(result.message || 'Web3Forms imefeli');
  return result;
}
