from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
FONT = "Arial Unicode MS"
INK = "172033"
BLUE = "38318B"
CYAN = "18B9CA"
MUTED = "68748A"
FILL = "E8EEF5"
WARN = "FFF1ED"


def set_font(run, size=11, bold=False, color=INK):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    rfonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    for key in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{key}"), FONT)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    if shd.getparent() is None:
        tc_pr.append(shd)


def set_cell_width(cell, width_dxa):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
    tc_w.set(qn("w:w"), str(width_dxa))
    tc_w.set(qn("w:type"), "dxa")
    if tc_w.getparent() is None:
        tc_pr.append(tc_w)


def configure(doc, short_title):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.38)
    section.footer_distance = Inches(0.38)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    for name, size, before, after in (("Heading 1", 16, 18, 10), ("Heading 2", 13, 14, 7), ("Heading 3", 12, 10, 5)):
        style = styles[name]
        style.font.name = FONT
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(BLUE)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)

    header = section.header.paragraphs[0]
    run = header.add_run(f"星海知枢  |  {short_title}")
    set_font(run, 8.5, True, MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = footer.add_run("主题 3.2.0  ·  Obsidian 主题")
    set_font(run, 8.5, False, MUTED)


def title(doc, text, subtitle):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(55)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p.add_run("星海知枢"), 14, True, CYAN)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p.add_run(text), 27, True, BLUE)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(26)
    set_font(p.add_run(subtitle), 13, False, MUTED)
    add_table(doc, [
        ("产品类型", "Obsidian 外观主题，不是社区插件"),
        ("主题版本", "3.2.0"),
        ("最低版本", "Obsidian 1.9.0"),
        ("适用系统", "macOS 与 Windows"),
        ("更新日期", "2026-08-15"),
    ])
    note(doc, "范围说明", "本次发布只包含主题 CSS 与实际引用的图片资源，不包含 JavaScript、工作台、测试库或任务管理功能。")
    doc.add_page_break()


def add_table(doc, rows):
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    table.rows[0].cells[0].text = "项目"
    table.rows[0].cells[1].text = "说明"
    widths = (2700, 6660)
    for row_index, row in enumerate(table.rows):
        for index, cell in enumerate(row.cells):
            set_cell_width(cell, widths[index])
            shade(cell, FILL)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for run in cell.paragraphs[0].runs:
                set_font(run, 10, True, BLUE)
    for label, detail in rows:
        cells = table.add_row().cells
        cells[0].text = label
        cells[1].text = detail
        for index, cell in enumerate(cells):
            set_cell_width(cell, widths[index])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for run in cell.paragraphs[0].runs:
                set_font(run, 10, index == 0, INK)
    doc.add_paragraph()


def note(doc, label, text, warning=False):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    cell = table.cell(0, 0)
    set_cell_width(cell, 9360)
    shade(cell, WARN if warning else "EEF2FF")
    p = cell.paragraphs[0]
    set_font(p.add_run(f"{label}："), 10, True, "A33424" if warning else BLUE)
    set_font(p.add_run(text), 10)
    doc.add_paragraph()


def heading(doc, text, level=1):
    doc.add_heading(text, level=level)


def body(doc, text):
    p = doc.add_paragraph()
    set_font(p.add_run(text))


def bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.375)
        p.paragraph_format.first_line_indent = Inches(-0.188)
        p.paragraph_format.space_after = Pt(4)
        for run in p.runs:
            set_font(run)
        if not p.runs:
            set_font(p.add_run(item))
        else:
            p.runs[0].text = item


def steps(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.left_indent = Inches(0.375)
        p.paragraph_format.first_line_indent = Inches(-0.188)
        p.paragraph_format.space_after = Pt(4)
        set_font(p.add_run(item))


def build_install():
    doc = Document()
    configure(doc, "macOS / Windows 安装指导")
    title(doc, "macOS / Windows 安装指导说明", "从下载、复制到启用与回滚")
    heading(doc, "1. 安装前确认")
    bullets(doc, [
        "本包是 Obsidian 主题，不是独立应用、社区插件或工作台。",
        "确认 Obsidian 版本不低于 1.9.0。",
        "建议备份知识库中的 `.obsidian/appearance.json`。",
        "安装和覆盖文件前完全退出 Obsidian。",
    ])
    heading(doc, "2. 安装包内容")
    add_table(doc, [
        ("manifest.json", "主题名称、版本和最低 Obsidian 版本。"),
        ("theme.css", "主题全部外观规则。"),
        ("starfield-dark", "深色模式背景资源。"),
        ("starfield-light", "浅色模式背景资源。"),
    ])
    note(doc, "安全性", "主题不包含 `main.js` 或其他 JavaScript，不会读取、修改或上传 Markdown 笔记。")
    heading(doc, "3. macOS 安装")
    steps(doc, [
        "解压 `星海知枢-Obsidian主题-v3.2.0.zip`。",
        "在 Finder 中打开知识库；看不到 `.obsidian` 时按 `Command + Shift + .`。",
        "把整个 `星海知枢` 文件夹复制到 `知识库/.obsidian/themes/星海知枢/`。",
        "启动 Obsidian，在“设置 → 外观 → 主题”中选择“星海知枢”。",
    ])
    heading(doc, "4. Windows 安装")
    steps(doc, [
        "解压 `星海知枢-Obsidian主题-v3.2.0.zip`。",
        "在资源管理器中开启“查看 → 显示 → 隐藏的项目”。",
        "把整个 `星海知枢` 文件夹复制到 `知识库\\.obsidian\\themes\\星海知枢\\`。",
        "启动 Obsidian，在“设置 → 外观 → 主题”中选择“星海知枢”。",
    ])
    note(doc, "Windows 注意", "不需要管理员权限；不要把主题复制到 Obsidian 程序目录或 `%APPDATA%`。", True)
    heading(doc, "5. 验收、升级和回滚")
    bullets(doc, [
        "切换深色与浅色模式，确认背景、文字、文件树、标签页和弹窗清晰可读。",
        "升级时完全退出 Obsidian，再用新版主题文件夹覆盖旧目录。",
        "回滚时先切换其他主题，再删除 `.obsidian/themes/星海知枢/`。",
        "主题卸载不会删除 Markdown 笔记。",
    ])
    doc.save(DOCS / "星海知枢-macOS与Windows安装指导说明.docx")


def build_manual():
    doc = Document()
    configure(doc, "主题操作手册")
    title(doc, "主题操作手册", "深浅模式、日常使用、升级与排障")
    heading(doc, "1. 产品边界")
    body(doc, "星海知枢只负责 Obsidian 外观。它统一应用外壳、文件树、标签页、编辑器、弹窗、按钮、状态栏和关系图谱的视觉样式。")
    add_table(doc, [
        ("包含", "主题 CSS、深色背景、浅色背景、主题清单。"),
        ("不包含", "工作台、社区插件、任务写回、项目、专注计时、日历。"),
        ("数据权限", "不读取、不写入、不上传知识库内容。"),
    ])
    heading(doc, "2. 深色与浅色模式")
    steps(doc, [
        "打开 Obsidian“设置 → 外观”。",
        "在“基础颜色方案”中选择深色或浅色。",
        "确认正文、标题、链接、文件树和弹窗的对比度正常。",
    ])
    bullets(doc, [
        "深色模式使用紫蓝星海背景和深色半透明面板。",
        "浅色模式使用雾蓝星云背景和浅色高可读面板。",
        "两套模式包含在同一主题中，无需重复安装。",
    ])
    heading(doc, "3. 日常使用")
    bullets(doc, [
        "主题启用后自动作用于当前知识库界面。",
        "切换笔记、编辑模式或关系图谱不需要额外配置。",
        "社区插件的自定义界面可能使用自己的样式，主题不能保证完全覆盖。",
        "若局部显示异常，先停用 CSS 片段并重新加载 Obsidian。",
    ])
    heading(doc, "4. 升级与卸载")
    steps(doc, [
        "备份 `.obsidian/appearance.json` 和当前主题目录。",
        "完全退出 Obsidian。",
        "升级时覆盖 `星海知枢` 主题文件夹；卸载时删除该文件夹。",
        "重新启动 Obsidian并检查外观设置。",
    ])
    heading(doc, "5. 常见问题")
    add_table(doc, [
        ("主题列表中没有出现", "检查目录层级，`manifest.json` 必须直接位于 `星海知枢` 文件夹。"),
        ("背景图片不显示", "确认 `assets` 中两个 starfield 文件存在且文件名未改变。"),
        ("更新后仍是旧样式", "完全退出 Obsidian 后覆盖文件，再重新启动。"),
        ("局部颜色异常", "暂时停用 CSS 片段或其他修改外观的组件后复核。"),
        ("需要恢复默认", "在外观设置中切换为 Obsidian 默认主题。"),
    ])
    note(doc, "数据说明", "停用或删除主题只改变外观，不会删除笔记、附件、标签或 Properties。")
    doc.save(DOCS / "星海知枢-产品操作手册.docx")


if __name__ == "__main__":
    DOCS.mkdir(exist_ok=True)
    build_install()
    build_manual()
    print(DOCS / "星海知枢-macOS与Windows安装指导说明.docx")
    print(DOCS / "星海知枢-产品操作手册.docx")
