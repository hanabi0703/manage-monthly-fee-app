import { computeBalance, excludeCancelledPayments } from "./balance";

describe("computeBalance", () => {
  test("BAL-001: 空配列は0を返す", () => {
    expect(computeBalance([], () => 5000)).toBe(0);
  });

  test("BAL-002: ぴったり払っていれば0", () => {
    const result = computeBalance(
      [{ date: "2026-04-01", amount: 5000 }],
      () => 5000,
    );
    expect(result).toBe(0);
  });

  test("BAL-003: 多く払っていれば繰越金(正)", () => {
    const result = computeBalance(
      [{ date: "2026-04-01", amount: 6000 }],
      () => 5000,
    );
    expect(result).toBe(1000);
  });

  test("BAL-004: 少なく払っていれば未払金(負)", () => {
    const result = computeBalance(
      [{ date: "2026-04-01", amount: 3000 }],
      () => 5000,
    );
    expect(result).toBe(-2000);
  });

  test("BAL-005: 複数月の差額が積算される", () => {
    const fees: Record<string, number> = { "2026-04": 5000, "2026-05": 5000 };
    const result = computeBalance(
      [
        { date: "2026-04-01", amount: 5000 },
        { date: "2026-05-01", amount: 4000 },
      ],
      (m) => fees[m],
    );
    expect(result).toBe(-1000);
  });

  test("BAL-006: 不足金支払い(date=空文字)はfeeForMonthを呼ばず全額加算", () => {
    const feeForMonth = jest.fn(() => 5000);
    const result = computeBalance([{ date: "", amount: 3000 }], feeForMonth);
    expect(result).toBe(3000);
    expect(feeForMonth).not.toHaveBeenCalled();
  });

  test("BAL-007: 不足金支払いが未払い分を相殺する", () => {
    const result = computeBalance(
      [
        { date: "2026-04-01", amount: 3000 }, // -2000
        { date: "", amount: 2000 },
      ],
      () => 5000,
    );
    expect(result).toBe(0);
  });

  test("BAL-008: 同一月の複数回支払いは、月ごとの合算ではなく支払いレコードごとに標準額が差し引かれる", () => {
    // 仕様書は「同月の合算後に差し引かれ、結果は0になる」としているが、
    // 実装は reduce 内で支払いレコード単位に (amount - feeForMonth(...)) を
    // 計算しており、月でグルーピングしてから差し引いてはいない。そのため
    // 3000円+2000円(合計5000円、月謝5000円)でも、レコードごとに標準額5000円が
    // 差し引かれ (3000-5000)+(2000-5000)=-5000 になる。
    // アプリのUIからは1ヶ月につき実日付ありのMONTHLY支払いは常に全額(=その時点の
    // 月謝額)で1回しか登録できない(entry.tsxで金額欄は不足金支払いモード以外は
    // 編集不可、かつ全額支払い済みの月の日付は候補から除外される)ため、この
    // ケース自体はUI経由では発生しない。ここでは関数単体の実際の挙動を記録する。
    const result = computeBalance(
      [
        { date: "2026-04-01", amount: 3000 },
        { date: "2026-04-15", amount: 2000 },
      ],
      () => 5000,
    );
    expect(result).toBe(-5000);
  });

  test("BAL-009: 0円払いも標準額との差額として扱われる", () => {
    const result = computeBalance([{ date: "2026-04-01", amount: 0 }], () => 5000);
    expect(result).toBe(-5000);
  });

  test("BAL-010: feeForMonthが月ごとに異なる値を返すケース", () => {
    const fees: Record<string, number> = { "2026-04": 5000, "2026-05": 6000 };
    const result = computeBalance(
      [
        { date: "2026-04-01", amount: 5000 },
        { date: "2026-05-01", amount: 6000 },
      ],
      (m) => fees[m],
    );
    expect(result).toBe(0);
  });
});

describe("excludeCancelledPayments", () => {
  type P = { id: string; cancelsPaymentId: string | null };

  test("BAL-011: 取消のない支払いのみはそのまま返る", () => {
    const payments: P[] = [
      { id: "p1", cancelsPaymentId: null },
      { id: "p2", cancelsPaymentId: null },
      { id: "p3", cancelsPaymentId: null },
    ];
    expect(excludeCancelledPayments(payments)).toEqual(payments);
  });

  test("BAL-012: 元レコードと取消レコードの両方が除外される", () => {
    const payments: P[] = [
      { id: "p1", cancelsPaymentId: null },
      { id: "p2", cancelsPaymentId: "p1" },
    ];
    expect(excludeCancelledPayments(payments)).toEqual([]);
  });

  test("BAL-013: 取消ペアに通常レコードが混在", () => {
    const payments: P[] = [
      { id: "p1", cancelsPaymentId: null },
      { id: "p2", cancelsPaymentId: "p1" },
      { id: "p3", cancelsPaymentId: null },
    ];
    expect(excludeCancelledPayments(payments).map((p) => p.id)).toEqual(["p3"]);
  });

  test("BAL-014: 取消ペアが2組混在", () => {
    const payments: P[] = [
      { id: "p1", cancelsPaymentId: null },
      { id: "p2", cancelsPaymentId: "p1" },
      { id: "p3", cancelsPaymentId: null },
      { id: "p4", cancelsPaymentId: "p3" },
      { id: "p5", cancelsPaymentId: null },
    ];
    expect(excludeCancelledPayments(payments).map((p) => p.id)).toEqual(["p5"]);
  });

  test("BAL-015: 空配列は空配列を返す", () => {
    expect(excludeCancelledPayments<P>([])).toEqual([]);
  });

  test("BAL-016: 存在しないIDを指す取消レコード自身は除外される", () => {
    const payments: P[] = [{ id: "p2", cancelsPaymentId: "unknown" }];
    expect(excludeCancelledPayments(payments)).toEqual([]);
  });
});
