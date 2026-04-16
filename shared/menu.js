const MENU = {
  pizzas: [
    { id: 'jamon_queso', name: 'Jamón y Queso', price: 150 },
    { id: 'hawaiana', name: 'Hawaiana', price: 195 },
    { id: 'pepperoni', name: 'Pepperoni', price: 165 },
    { id: '4_estaciones', name: '4 Estaciones', price: 170 },
    { id: 'bolognesa', name: 'Bolognesa', price: 240 },
    { id: 'surtida', name: 'Surtida', price: 300 },
  ],

  modifiers: [
    { id: 'orilla_queso', name: 'Orilla de Queso', price: 60 },
  ],

  extraIngredients: {
    price: 30, // per ingredient
    options: [
      'Jamón', 'Salami', 'Salchichas', 'Chorizo',
      'Tocino', 'Champiñones', 'Pimiento', 'Pepperoni', 'Piña'
    ]
  },

  sides: [
    { id: 'pan_ajo', name: 'Pan con Ajo Sencillo', price: 30 },
    { id: 'pan_ajo_queso', name: 'Pan con Ajo y Queso', price: 50 },
  ],

  beverages: [
    { id: 'te_litro', name: 'Té de Litro', price: 30 },
  ],

  specials: [
    { id: 'submarino', name: 'Submarino', price: 120 },
    { id: 'calzone', name: 'Calzoné', price: 120 },
  ]
};

// Works in both Node.js and the browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MENU;
}