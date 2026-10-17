import { openLiveLab } from './LiveLab';
const tools = [
  'writer',
  'calculator',
  'geometry',
  'equations',
  'units',
  'statistics',
  'blueprint',
  'rubric',
];
export function activateWorkspaceCard(card: any, navigate: (page: string) => void) {
  if (card.kind === 'live_room') {
    openLiveLab();
    return true;
  }
  if (card.kind === 'tool' && tools.includes(card.tool)) {
    sessionStorage.setItem('assistant-open-tool', card.tool);
    navigate('tools');
    window.dispatchEvent(new CustomEvent('assistant-open-tool', { detail: card.tool }));
    return true;
  }
  return false;
}
