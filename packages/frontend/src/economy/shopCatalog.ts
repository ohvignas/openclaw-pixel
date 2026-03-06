export interface ShopItem {
  id: string
  label: string
  category: ShopCategory
  price: number
  imagePath: string
  stackable: boolean
  furnitureType?: string
}

export type ShopCategory = 'desks' | 'chairs' | 'decor' | 'tech' | 'storage' | 'floors' | 'walls'

export const SHOP_CATALOG: ShopItem[] = [
  { id: 'desk',           label: 'Bureau',            category: 'desks',   price: 120, imagePath: '/assets/office/desk.png',          stackable: true, furnitureType: 'desk' },
  { id: 'writing-table',  label: "Table d'écriture",  category: 'desks',   price: 90,  imagePath: '/assets/office/writing-table.png', stackable: true },
  { id: 'stamping-table', label: 'Table tampon',      category: 'desks',   price: 80,  imagePath: '/assets/office/stamping-table.png',stackable: true },
  { id: 'chair',          label: 'Chaise',            category: 'chairs',  price: 40,  imagePath: '/assets/office/Chair.png',         stackable: true, furnitureType: 'chair' },
  { id: 'PC1',            label: 'PC Gamer',          category: 'tech',    price: 75,  imagePath: '/assets/office/PC1.png',           stackable: true },
  { id: 'PC2',            label: 'PC Pro',            category: 'tech',    price: 75,  imagePath: '/assets/office/PC2.png',           stackable: true },
  { id: 'printer',        label: 'Imprimante',        category: 'tech',    price: 60,  imagePath: '/assets/office/printer.png',       stackable: true },
  { id: 'plant',          label: 'Plante',            category: 'decor',   price: 30,  imagePath: '/assets/office/plant.png',         stackable: true, furnitureType: 'plant' },
  { id: 'window',         label: 'Fenêtre',           category: 'decor',   price: 50,  imagePath: '/assets/office/Window.png',        stackable: true },
  { id: 'water-cooler',   label: 'Fontaine',          category: 'decor',   price: 35,  imagePath: '/assets/office/water-cooler.png',  stackable: true },
  { id: 'coffee-maker',   label: 'Cafetière',         category: 'decor',   price: 45,  imagePath: '/assets/office/coffee-maker.png',  stackable: true },
  { id: 'cabinet',        label: 'Armoire',           category: 'storage', price: 65,  imagePath: '/assets/office/cabinet.png',       stackable: true },
  { id: 'sink',           label: 'Évier',             category: 'storage', price: 40,  imagePath: '/assets/office/sink.png',          stackable: true },
  { id: 'trash',          label: 'Poubelle',          category: 'decor',   price: 15,  imagePath: '/assets/office/Trash.png',         stackable: true },
  { id: 'separately',     label: 'Bureau séparé',     category: 'desks',   price: 100, imagePath: '/assets/office/separately.png',    stackable: true },
]

export const SHOP_CATEGORIES: Array<{ id: ShopCategory; label: string; icon: string }> = [
  { id: 'desks',   label: 'Bureaux',  icon: '🖥' },
  { id: 'chairs',  label: 'Chaises',  icon: '🪑' },
  { id: 'tech',    label: 'Tech',     icon: '💻' },
  { id: 'decor',   label: 'Déco',     icon: '🌿' },
  { id: 'storage', label: 'Stockage', icon: '🗄' },
  { id: 'floors',  label: 'Sols',     icon: '🟫' },
  { id: 'walls',   label: 'Murs',     icon: '🧱' },
]
