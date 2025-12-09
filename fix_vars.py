import re

CONFIG_FILE = "waveshare.yaml"

def main():
    with open(CONFIG_FILE, "r") as f:
        content = f.read()

    # We need to fix the usage of 'top', 'DH', and 'FG' in the clock_7segment lambda.
    # I previously renamed declarations to clock_top, digit_height, fg_color.
    # But I missed updating the usages in the date section.

    # Pattern for the date section line causing error:
    # int date_y = top + DH + date_pad + extra_offset;
    pattern1 = r"int date_y = top \+ DH \+ date_pad \+ extra_offset;"
    replacement1 = r"int date_y = clock_top + digit_height + date_pad + extra_offset;"

    content = re.sub(pattern1, replacement1, content)

    # Pattern for usages of FG in strftime
    # it.strftime(cx, date_y, id(font_big_date), FG, TextAlign::CENTER,
    # There are multiple occurrences.
    # I can just replace ", FG," with ", fg_color," inside the clock_7segment lambda.
    # But to be safe, I'll restrict it.
    # The file is large, so finding the exact block is tricky with regex.
    # However, 'FG' is unique enough in this context if I check nearby text.

    # Let's replace 'FG' with 'fg_color' everywhere in the file?
    # Wait, 'FG' was defined as 'const Color FG(...)' in 'flip_clock' as well.
    # In 'flip_clock', I did NOT rename it. So I should NOT replace it globally.
    # I only renamed it in 'clock_7segment'.

    # In 'clock_7segment', I defined: const Color fg_color(...)
    # In 'flip_clock', it is: const Color FG(...)

    # So I must only replace 'FG' with 'fg_color' within 'clock_7segment'.

    # Let's read the file line by line and track which lambda we are in.

    lines = content.splitlines()
    new_lines = []
    in_clock_7segment = False

    for line in lines:
        if "- id: clock_7segment" in line:
            in_clock_7segment = True
        elif "- id: " in line:
            in_clock_7segment = False

        if in_clock_7segment:
            # Replace FG with fg_color
            # Be careful not to replace substrings (though FG is likely distinct)
            # Use regex for word boundary
            line = re.sub(r"\bFG\b", "fg_color", line)

            # Replace top with clock_top (if it's the variable usage)
            # Avoid replacing "top" in "top_y" or "stop"
            # The error line was: int date_y = top + DH + date_pad + extra_offset;
            # Also declarations: const int top = cy - DH/2; -> I already changed this to clock_top in previous step?
            # Let's check my previous overwrite.
            # Yes: "const int clock_top  = cy - digit_height/2;"

            # So I just need to catch usages.
            line = re.sub(r"\btop\b", "clock_top", line)

            # Replace DH with digit_height
            line = re.sub(r"\bDH\b", "digit_height", line)

            # Also check for DW -> digit_width just in case (though error log didn't mention it yet, it might be next)
            # My previous overwrite: "const int digit_width = std::max(18, (int)(dw_guess * s));"
            # Usage: "int x2 = x1 + digit_width + gap;" (I updated this in previous overwrite)
            # "int colon_x_left = x2 + digit_width;" (I updated this)
            # So DW should be mostly gone, but let's be safe.
            line = re.sub(r"\bDW\b", "digit_width", line)

        new_lines.append(line)

    with open(CONFIG_FILE, "w") as f:
        f.write("\n".join(new_lines) + "\n") # Ensure trailing newline

if __name__ == "__main__":
    main()
