// app/lib/similarity-calculator.ts

/**
 * 2つの配列の共通要素の数を計算します。
 * @param arr1 配列1
 * @param arr2 配列2
 * @returns 共通要素の数
 */
function countCommonElements<T>(arr1: T[], arr2: T[]): number {
  const set1 = new Set(arr1);
  let commonCount = 0;
  for (const item of arr2) {
    if (set1.has(item)) {
      commonCount++;
    }
  }
  return commonCount;
}

/**
 * 2つの配列のユニークな要素の合計数を計算します (和集合のサイズ)。
 * @param arr1 配列1
 * @param arr2 配列2
 * @returns ユニークな要素の合計数
 */
function countUniqueElements<T>(arr1: T[], arr2: T[]): number {
  const unionSet = new Set([...arr1, ...arr2]);
  return unionSet.size;
}

/**
 * Jaccard距離行列を計算します。
 * @param idToKeysMap IDとそれに対応するスレッドキーのマップ
 * @returns Jaccard距離行列
 */
export function calculateJaccardDistanceMatrix(idToKeysMap: { [id: string]: string[] }): number[][] {
  const ids = Object.keys(idToKeysMap);
  const numIds = ids.length;
  const distanceMatrix: number[][] = Array(numIds)
    .fill(0)
    .map(() => Array(numIds).fill(0));

  for (let i = 0; i < numIds; i++) {
    for (let j = i; j < numIds; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0; // 同じID間の距離は0
      } else {
        const id1 = ids[i];
        const id2 = ids[j];
        const keys1 = idToKeysMap[id1];
        const keys2 = idToKeysMap[id2];

        const commonKeysCount = countCommonElements(keys1, keys2);
        const uniqueKeysCount = countUniqueElements(keys1, keys2);

        let jaccardDistance: number;
        if (uniqueKeysCount === 0) {
          // 両方のキーセットが空の場合、完全に一致とみなすか、完全に不一致とみなすか。
          // ここでは、データがないため比較不能として最大距離(1)とする。
          // または、ビジネスロジックに応じて0とすることも可能。
          jaccardDistance = 1;
        } else {
          const jaccardSimilarity = commonKeysCount / uniqueKeysCount;
          jaccardDistance = 1 - jaccardSimilarity;
        }
        
        distanceMatrix[i][j] = jaccardDistance;
        distanceMatrix[j][i] = jaccardDistance; // 対称行列
      }
    }
  }

  return distanceMatrix;
}