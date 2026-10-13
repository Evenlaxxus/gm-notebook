import type { Note, TreeNode } from './model'
import { createId } from './ids'

export function createNote(text: string): Note {
  const paragraphs = text.split('\n\n')
  return {
    id: createId(),
    updatedAt: new Date().toISOString(),
    blocks: (paragraphs.length ? paragraphs : ['']).map((paragraph, index) => ({
      id: createId(),
      type: 'text' as const,
      text: paragraph,
      x: 8,
      y: 20 + index * 180,
      width: 82,
    })),
  }
}

export const initialTree: TreeNode = {
  id: 'root',
  name: 'Notatki',
  note: createNote(''),
  children: [
    {
      id: 'campaign',
      name: 'Wybrzeze Popiolow',
      note: createNote(''),
      children: [
        {
          id: 'coast-note',
          name: 'The Drowned Coast',
          note: createNote('Gdy odplyw odslania czarne skaly, na plazy pojawiaja sie drzwi. Nie maja scian ani framugi. Prowadza wprost pod powierzchnie morza, a zza nich slychac dzwon bijacy w rytmie przyplywu.\n\nMiejscowi omijaja zatoke po zmroku. Twierdza, ze morze oddaje wszystko, co zabralo, ale nigdy w tej samej postaci.'),
          children: [],
        },
        { id: 'port-note', name: 'Port Szeptow', note: createNote('Port budzi sie przed switem. Rybacy zostawiaja przy kei puste latarnie, by zaznaczyc miejsca, do ktorych nie nalezy cumowac.'), children: [] },
        { id: 'npcs-note', name: 'Postacie niezalezne', note: createNote('Kapitan Veyr zna droge do zatoki, ale za kazdym razem opowiada inna wersje swojej historii.'), children: [] },
      ],
    },
    {
      id: 'ideas',
      name: 'Pomysly na sesje',
      note: createNote(''),
      children: [
        { id: 'lighthouse-note', name: 'Zaginiony latarnik', note: createNote('Latarnia wciaz swieci, choc od tygodnia nikt nie widzial jej straznika.'), children: [] },
        { id: 'oath-note', name: 'Cena przysiegi', note: createNote('Stara przysiega chroni miasto, ale kazdego roku wymaga nowego imienia.'), children: [] },
      ],
    },
  ],
}