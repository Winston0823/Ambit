// New-chat (people search) for the founder group. Re-uses the candidate
// screen; without this re-export the inbox "+" resolved to (candidate)/chat/
// new, jumping groups into a stack with no inbox root and dead-ending the
// back button. The shared screen's useSegments-based routing keeps it in the
// founder group.
export { default } from '../../../(candidate)/(tabs)/chat/new';
