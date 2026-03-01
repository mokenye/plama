export function formatActivity(activity: any): string {
  const { action, userName, entityName, metadata } = activity;

  switch (action) {
    case 'card_created':
      return `${userName} created card "${entityName}"`;
    
    case 'card_moved':
      return `${userName} moved "${entityName}" from ${metadata?.fromList} to ${metadata?.toList}`;
    
    case 'card_updated':
      return `${userName} updated card "${entityName}"`;
    
    case 'card_deleted':
      return `${userName} deleted card "${entityName}"`;
    
    case 'list_created':
      return `${userName} created list "${entityName}"`;
    
    case 'list_deleted':
      return `${userName} deleted list "${entityName}"`;
    
    case 'member_added':
      return `${userName} added ${metadata?.memberName} to the board`;
    
    default:
      return `${userName} performed an action`;
  }
}