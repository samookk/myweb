from __future__ import annotations

"""
WindPy 查询伦敦金现（XAUUSD）走势并导出 Excel/CSV。

零基础使用方法：
1) 确保 Wind 终端能打开（且账号有 API 权限）
2) 双击同目录 run_xauusd.bat
"""

import sys
from datetime import date

import pandas as pd


def main() -> int:
    try:
        from WindPy import w  # type: ignore
    except Exception as e:
        print("未能导入 WindPy。")
        print("请确认：已安装 Wind，且本机 WindPy 可用。")
        print("原始错误：", repr(e))
        return 2

    code = "XAUUSD"  # 伦敦金现（常用写法；若你账号不支持，报错信息发我我帮你改）
    field = "close"

    # 默认取最近 365 天；你也可以手动改成固定日期字符串：YYYY-MM-DD
    end = date.today().isoformat()
    start = (date.today().replace(year=date.today().year - 1)).isoformat()

    options = "PriceAdj=F"

    print(f"准备查询：{code}  字段：{field}  区间：{start} -> {end}")

    w.start()
    r = w.wsd(code, field, start, end, options)

    if getattr(r, "ErrorCode", None) != 0:
        print(f"WindPy 查询失败，ErrorCode={r.ErrorCode}")
        # 有些环境会有 ErrorMsg
        msg = getattr(r, "ErrorMsg", None)
        if msg:
            print("ErrorMsg:", msg)
        print("\n可能原因：")
        print("- 账号没有 Wind API 权限")
        print("- 伦敦金现代码在你账号下不是 XAUUSD（需要换代码）")
        print("- 网络/终端状态异常")
        print("\n请把以上输出整段复制给我，我帮你改到可用。")
        return 3

    times = getattr(r, "Times", None) or []
    data = getattr(r, "Data", None) or [[]]

    if not times or not data or not data[0]:
        print("返回为空：没有拿到数据。")
        print("请把输出复制给我，我帮你确认代码/权限。")
        return 4

    df = pd.DataFrame(
        {field: data[0]},
        index=pd.to_datetime(times),
    )
    df.index.name = "date"
    df["ret"] = df[field].pct_change()

    out_csv = "XAUUSD.csv"
    out_xlsx = "XAUUSD.xlsx"

    df.to_csv(out_csv, encoding="utf-8-sig")
    df.to_excel(out_xlsx)

    print(f"成功导出：{out_xlsx} / {out_csv}")
    print("你可以用 Excel 打开 XAUUSD.xlsx 查看走势。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

