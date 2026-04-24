import * as fs from 'fs';
import * as path from 'path';

let content = fs.readFileSync(path.join(process.cwd(), 'src/game/NetworkManager.ts'), 'utf8');
if (!content.includes('import { useGameStore }')) {
  content = "import { useGameStore } from '../store/gameStore';\n" + content;
}
content = content.replace(
  /window\.dispatchEvent\(new CustomEvent\('chatMessage', { detail: data }\)\);/g,
  'useGameStore.getState().addChatMessage(data.sender, data.message);'
);
content = content.replace(
  /window\.dispatchEvent\(new CustomEvent\('chatMessage', { detail: { sender, message } }\)\);/g,
  'useGameStore.getState().addChatMessage(sender, message);'
);
fs.writeFileSync(path.join(process.cwd(), 'src/game/NetworkManager.ts'), content, 'utf8');

// Now we need to modify ChatUI to use `useGameStore` instead of events.
let chatContent = fs.readFileSync(path.join(process.cwd(), 'src/components/ChatUI.tsx'), 'utf8');
if (!chatContent.includes('import { useGameStore }')) {
  chatContent = "import { useGameStore } from '../store/gameStore';\n" + chatContent;
}

// Remove useState for messages and useEffect for chatMessage, and use the store mapping.
chatContent = chatContent.replace(
  /const \[messages, setMessages\] = useState<ChatMessage\[\]>\(\[\]\);\n\s*\/\/ Handle incoming messages\n\s*useEffect\(\(\) => \{\n\s*const handleChat = \(e: any\) => \{\n\s*setMessages\(prev => \[\.\.\.prev\.slice\(-49\), e\.detail\]\);\n\s*\};\n\s*window\.addEventListener\('chatMessage', handleChat\);\n\s*return \(\) => window\.removeEventListener\('chatMessage', handleChat\);\n\s*\}, \[\]\);/g,
  `const messages = useGameStore(state => state.chatMessages);`
);

chatContent = chatContent.replace(
  /setMessages\(prev => \[\.\.\.prev\.slice\(-49\), { sender: 'System', message: `§cUnknown server: \${target}` }\s*\]\);/g,
  `useGameStore.getState().addChatMessage('System', \`§cUnknown server: \${target}\`);`
);

fs.writeFileSync(path.join(process.cwd(), 'src/components/ChatUI.tsx'), chatContent, 'utf8');
