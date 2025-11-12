// app/lib/distance-calculator.ts

/**
 * IDの配列からダミーの距離行列を計算します。
 * この関数は後で実際の距離計算ロジックに置き換える必要があります。
 *
 * @param ids IDの配列
 * @returns 距離行列 (2次元配列)。対角成分は0、それ以外は1。
 */
export function calculateDistanceMatrix(ids: string[]): number[][] {
  const size = ids.length;
  const matrix: number[][] = Array(size).fill(0).map(() => Array(size).fill(0));

  for (let i = 0; i < size; i++) {
    for (let j = i; j < size; j++) {
      if (i === j) {
        matrix[i][j] = 0; // 同じID同士の距離は0
      } else {
        // ダミーの距離として1を設定
        // TODO: ここに実際の距離計算ロジックを実装する
        const dummyDistance = 1.0;
        matrix[i][j] = dummyDistance;
        matrix[j][i] = dummyDistance; // 対称行列
      }
    }
  }

  return matrix;
}
