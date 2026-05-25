export function generateTicketId(date = new Date()) {
  // Demo-friendly ticket IDs. A database can enforce uniqueness later.
  const year = date.getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `EXL-${year}-${randomNumber}`;
}

export function findTicketIdInText(value: string) {
  const match = value.toUpperCase().match(/\bEXL-\d{4}-\d{4,}\b/);

  return match?.[0] || null;
}

export function isNewTicketIntent(value: string) {
  const text = value.trim().toLowerCase();
  const newTicketWords = ['no', 'new', 'new ticket', 'create ticket', 'create new', 'নতুন', 'না'];

  return newTicketWords.some((word) => text === word || text.includes(word));
}
