import type { Activity, Location } from "@/lib/types"

/** Sample places in Lisbon, positioned on the static map illustration (0–100). */
export const SAMPLE_LOCATIONS: Location[] = [
  { id: "loc-airport", name: "Lisbon Airport", x: 78, y: 12 },
  { id: "loc-hotel", name: "Hotel in Chiado", x: 52, y: 58 },
  { id: "loc-alfama", name: "Alfama", x: 66, y: 60 },
  { id: "loc-castle", name: "São Jorge Castle", x: 63, y: 52 },
  { id: "loc-baixa", name: "Praça do Comércio", x: 58, y: 68 },
  { id: "loc-timeout", name: "Time Out Market", x: 46, y: 70 },
  { id: "loc-belem-tower", name: "Belém Tower", x: 8, y: 78 },
  { id: "loc-jeronimos", name: "Jerónimos Monastery", x: 14, y: 72 },
  { id: "loc-pasteis", name: "Pastéis de Belém", x: 16, y: 74 },
  { id: "loc-lxfactory", name: "LX Factory", x: 32, y: 74 },
  { id: "loc-bairro", name: "Bairro Alto", x: 48, y: 56 },
  { id: "loc-miradouro", name: "Miradouro da Graça", x: 64, y: 46 },
]

/** The activity library users drag from. Plans copy what they use. */
export const SAMPLE_ACTIVITIES: Activity[] = [
  { id: "act-arrive", title: "Arrive & check in", category: "travel", duration: 90, locationId: "loc-hotel" },
  { id: "act-airport", title: "Airport transfer", category: "travel", duration: 45, locationId: "loc-airport", cost: 18 },
  { id: "act-tram28", title: "Ride Tram 28", category: "travel", duration: 60, locationId: "loc-baixa", cost: 3 },
  { id: "act-castle", title: "São Jorge Castle", category: "sight", duration: 120, locationId: "loc-castle", cost: 15 },
  { id: "act-alfama-walk", title: "Walk through Alfama", category: "activity", duration: 90, locationId: "loc-alfama" },
  { id: "act-miradouro", title: "Sunset at Miradouro da Graça", category: "sight", duration: 60, locationId: "loc-miradouro" },
  { id: "act-baixa", title: "Praça do Comércio", category: "sight", duration: 45, locationId: "loc-baixa" },
  { id: "act-jeronimos", title: "Jerónimos Monastery", category: "sight", duration: 90, locationId: "loc-jeronimos", cost: 12 },
  { id: "act-belem", title: "Belém Tower", category: "sight", duration: 60, locationId: "loc-belem-tower", cost: 9 },
  { id: "act-pasteis", title: "Pastéis de Belém", category: "food", duration: 30, locationId: "loc-pasteis", cost: 8 },
  { id: "act-timeout", title: "Lunch at Time Out Market", category: "food", duration: 75, locationId: "loc-timeout", cost: 25 },
  { id: "act-fado", title: "Fado dinner", category: "food", duration: 150, locationId: "loc-alfama", cost: 55 },
  { id: "act-bairro", title: "Evening in Bairro Alto", category: "activity", duration: 120, locationId: "loc-bairro", cost: 30 },
  { id: "act-lxfactory", title: "Browse LX Factory", category: "activity", duration: 90, locationId: "loc-lxfactory" },
  { id: "act-coffee", title: "Coffee break", category: "rest", duration: 30, cost: 4 },
  { id: "act-nap", title: "Rest at hotel", category: "rest", duration: 60, locationId: "loc-hotel" },
]
