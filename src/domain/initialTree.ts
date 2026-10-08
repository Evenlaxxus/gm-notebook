import type { Note, TreeBranch } from './model'
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

export const initialTree: TreeBranch = {
  id: 'root',
  type: 'branch',
  name: 'Notatki',
  children: [
    {
      id: 'campaign',
      type: 'branch',
      name: 'Wybrzeze Popiolow',
      children: [
        {
          id: 'coast-note',
          type: 'leaf',
          name: 'The Drowned Coast',
          note: createNote('Gdy odplyw odslania czarne skaly, na plazy pojawiaja sie drzwi. Nie maja scian ani framugi. Prowadza wprost pod powierzchnie morza, a zza nich slychac dzwon bijacy w rytmie przyplywu.\n\nMiejscowi omijaja zatoke po zmroku. Twierdza, ze morze oddaje wszystko, co zabralo, ale nigdy w tej samej postaci.'),
        },
        { id: 'port-note', type: 'leaf', name: 'Port Szeptow', note: createNote('Port budzi sie przed switem. Rybacy zostawiaja przy kei puste latarnie, by zaznaczyc miejsca, do ktorych nie nalezy cumowac.') },
        { id: 'npcs-note', type: 'leaf', name: 'Postacie niezalezne', note: createNote('Kapitan Veyr zna droge do zatoki, ale za kazdym razem opowiada inna wersje swojej historii.') },
      ],
    },
    {
      id: 'ideas',
      type: 'branch',
      name: 'Pomysly na sesje',
      children: [
        { id: 'lighthouse-note', type: 'leaf', name: 'Zaginiony latarnik', note: createNote('Latarnia wciaz swieci, choc od tygodnia nikt nie widzial jej straznika.') },
        { id: 'oath-note', type: 'leaf', name: 'Cena przysiegi', note: createNote('Stara przysiega chroni miasto, ale kazdego roku wymaga nowego imienia.') },
      ],
    },
  ],
}