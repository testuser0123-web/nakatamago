// app/lib/id-parser.ts

/**
 * 指定されたスレッドキーからIDの一覧を取得します。
 * データはプレーンテキスト形式で、各行に 'ID:{user_id}<>' の形式でIDが含まれることを前提とします。
 *
 * @param threadKey スレッドのキー
 * @returns 重複を除いたIDの配列
 */
export async function getIdsFromThreadKey(threadKey: string): Promise<string[]> {
  // 新しいURL形式
  const url = `https://bbs.eddibb.cc/liveedge/dat/${threadKey}.dat`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // 404 Not Foundなどの場合、空の配列を返す
      if (response.status === 404) {
        console.log(`Thread data not found for key: ${threadKey}`);
        return [];
      }
      throw new Error(`Failed to fetch thread data: ${response.statusText}`);
    }

    const textData = await response.text();
    const lines = textData.split('\n');
    const ids = new Set<string>();
    
    // ID:{user_id}<> のパターンにマッチする正規表現
    const idRegex = /ID:([^<]+)<>/;

    for (const line of lines) {
      const match = line.match(idRegex);
      if (match && match[1]) {
        ids.add(match[1]);
      }
    }

    return Array.from(ids);
  } catch (error) {
    console.error('Error fetching or parsing thread data:', error);
    return [];
  }
}
