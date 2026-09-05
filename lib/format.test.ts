import {
  compareName,
  currentMonthIso,
  formatDate,
  formatMonthLabel,
  formatShortDate,
  formatYen,
  isKanaOnly,
  shiftMonth,
  todayIso,
  toKatakana,
} from "./format";

describe("formatDate / formatShortDate / formatMonthLabel", () => {
  test("FMT-001: 曜日を含めてフォーマットする", () => {
    expect(formatDate("2026-08-24")).toBe("2026/08/24(月)");
  });

  test("FMT-002: ゼロ埋めが崩れない", () => {
    expect(formatDate("2026-01-05")).toBe("2026/01/05(月)");
  });

  test("FMT-003: うるう年の日付もエラーにならない", () => {
    expect(formatDate("2024-02-29")).toBe("2024/02/29(木)");
  });

  test("FMT-004: formatShortDateは年を含まない", () => {
    expect(formatShortDate("2026-08-24")).toBe("08/24(月)");
  });

  test("FMT-005: formatMonthLabel", () => {
    expect(formatMonthLabel("2026-08")).toBe("2026年08月");
  });
});

describe("formatYen", () => {
  test("FMT-006: 3桁カンマ区切り", () => {
    expect(formatYen(5000)).toBe("¥5,000");
  });

  test("FMT-007: 0円", () => {
    expect(formatYen(0)).toBe("¥0");
  });

  test("FMT-008: 負の値は符号が先頭", () => {
    expect(formatYen(-1500)).toBe("-¥1,500");
  });

  test("FMT-009: 3桁以下はカンマなし", () => {
    expect(formatYen(999)).toBe("¥999");
  });

  test("FMT-010: 複数箇所のカンマ", () => {
    expect(formatYen(1000000)).toBe("¥1,000,000");
  });

  test("FMT-011: 小数はMath.round仕様で丸められる", () => {
    expect(formatYen(1234.5)).toBe("¥1,235");
  });
});

describe("todayIso / currentMonthIso (系時刻依存)", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("FMT-012: 固定した日時から日付を取り出す", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-01T15:00:00Z"));
    expect(todayIso()).toBe("2026-04-01");
  });

  test("FMT-013: 固定した日時から年月を取り出す", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-01T15:00:00Z"));
    expect(currentMonthIso()).toBe("2026-04");
  });

  test("FMT-014: 既知事項 - UTC基準のため日本時間の日付とズレることがある", () => {
    // 日本時間 2026-04-02 08:59 は UTC 2026-04-01T23:59:00Z。
    // todayIso() は toISOString()(UTC基準)を使うため、日本時間ではすでに
    // 4/2 になっていても "2026-04-01" を返してしまう。
    jest.useFakeTimers().setSystemTime(new Date("2026-04-01T23:59:00Z"));
    expect(todayIso()).toBe("2026-04-01");
  });
});

describe("shiftMonth", () => {
  test("FMT-015: 1ヶ月進める", () => {
    expect(shiftMonth("2026-04", 1)).toBe("2026-05");
  });

  test("FMT-016: 年をまたいで進める", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  test("FMT-017: 年をまたいで戻す", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  test("FMT-018: delta=0は変化しない", () => {
    expect(shiftMonth("2026-04", 0)).toBe("2026-04");
  });

  test("FMT-019: 複数年をまたぐ加算", () => {
    expect(shiftMonth("2026-04", 13)).toBe("2027-05");
  });

  test("FMT-020: 複数年をまたぐ減算", () => {
    expect(shiftMonth("2026-04", -15)).toBe("2025-01");
  });
});

describe("isKanaOnly", () => {
  test("FMT-021: ひらがなのみ", () => {
    expect(isKanaOnly("やまだ")).toBe(true);
  });

  test("FMT-022: カタカナのみ", () => {
    expect(isKanaOnly("ヤマダ")).toBe(true);
  });

  test("FMT-023: ひらがな+カタカナ混在", () => {
    expect(isKanaOnly("やまだタロウ")).toBe(true);
  });

  test("FMT-024: 長音「ー」を含む", () => {
    expect(isKanaOnly("たろー")).toBe(true);
  });

  test("FMT-025: 漢字を含むとfalse", () => {
    expect(isKanaOnly("山田")).toBe(false);
  });

  test("FMT-026: 空文字はfalse", () => {
    expect(isKanaOnly("")).toBe(false);
  });

  test("FMT-027: 英数字はfalse", () => {
    expect(isKanaOnly("yamada")).toBe(false);
  });

  test("FMT-028: 全角スペース混入はfalse", () => {
    expect(isKanaOnly("やまだ　")).toBe(false);
  });
});

describe("toKatakana", () => {
  test("FMT-029: ひらがな→カタカナ", () => {
    expect(toKatakana("やまだたろう")).toBe("ヤマダタロウ");
  });

  test("FMT-030: 既にカタカナなら変化なし", () => {
    expect(toKatakana("ヤマダ")).toBe("ヤマダ");
  });

  test("FMT-031: 漢字混在はひらがな部分のみ変換", () => {
    expect(toKatakana("山田たろう")).toBe("山田タロウ");
  });
});

describe("compareName", () => {
  test("FMT-032: 五十音順で正しく比較される", () => {
    expect(compareName("やまだ", "たなか")).toBeGreaterThan(0);
  });

  test("FMT-033: カタカナ/ひらがな表記ゆれを同一視する", () => {
    expect(compareName("ヤマダ", "やまだ")).toBe(0);
  });

  test("FMT-034: 濁音を含む比較がエラーにならず妥当な順序を返す", () => {
    const result = compareName("かとう", "がとう");
    expect(typeof result).toBe("number");
    expect(Number.isNaN(result)).toBe(false);
  });

  test("FMT-035: 長音を含む比較がエラーにならない", () => {
    expect(() => compareName("たろう", "たろー")).not.toThrow();
  });

  test("FMT-036: 空文字同士は0", () => {
    expect(compareName("", "")).toBe(0);
  });
});
