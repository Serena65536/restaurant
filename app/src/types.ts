export type Dish = {
  id: number;
  name: string;
  image: string;
  priceCents: number;
  description: string;
  available: boolean;
};

export type Category = {
  id: number;
  name: string;
  dishes: Dish[];
};

export type CartLine = {
  dish: Dish;
  qty: number;
};
