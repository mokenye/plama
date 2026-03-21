import { transformCard, transformList, transformBoard, transformMember } from '../src/utils/transform';

describe('Transform utils', () => {
  test('transformCard maps snake_case to camelCase', () => {
    const dbCard = {
      id: 1,
      list_id: 2,
      title: 'Test',
      description: 'desc',
      position: 3,
      created_by: 5,
      created_by_name: 'Alice',
      due_date: null,
      labels: ['bug'],
      assignees: [5],
      created_at: '2020-01-01',
      updated_at: '2020-01-02',
    } as any;

    const card = transformCard(dbCard);
    expect(card.id).toBe(1);
    expect(card.listId).toBe(2);
    expect(card.createdBy).toBe(5);
    expect(card.createdByName).toBe('Alice');
    expect(card.labels).toEqual(['bug']);
  });

  test('transformList and transformBoard and transformMember basic mappings', () => {
    const dbList = { id: 10, board_id: 1, title: 'L', position: 1, created_at: 'x' } as any;
    const list = transformList(dbList);
    expect(list.boardId).toBe(1);

    const dbBoard = { id: 2, title: 'B', owner_id: 3, owner_name: 'Bob', background_color: '#fff', member_count: 4 } as any;
    const board = transformBoard(dbBoard);
    expect(board.ownerId).toBe(3);

    const dbMember = { id: 7, name: 'M', email: 'm@e', avatar_url: null, role: 'member' } as any;
    const member = transformMember(dbMember);
    expect(member.avatarUrl).toBeNull();
    expect(member.role).toBe('member');
  });
});