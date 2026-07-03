/// Chat thread as an OUTER-stack detail route (sibling of the tabs), reached
/// from non-chat-tab surfaces — the project pipeline, the projects tab, Saved.
/// Pushing the in-tab `/chat/[id]` from outside the Chat tab hijacked that tab
/// (back landed on Discovery, and the Chat tab stuck on the opened thread), so
/// those entry points push `/thread/[id]` here instead: it lands on the current
/// stack, so back returns to where you came from and the Chat tab is untouched.
/// Same screen component as the in-tab thread.
export { default } from '../(tabs)/chat/[id]';
