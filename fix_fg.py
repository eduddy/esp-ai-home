import re

CONFIG_FILE = "waveshare.yaml"

def main():
    with open(CONFIG_FILE, "r") as f:
        content = f.read()

    # 1. Replace FG with fg_color in strftime calls
    # Pattern: it.strftime(..., FG, ...);
    # Regex to be safe.

    # This replacement is safe because FG should not be used in clock_7segment at all now.
    # But I must be careful not to touch flip_clock which uses FG (and defines it as FG).

    # I will extract the clock_7segment lambda content first? No, easier to just iterate lines and track state.

    lines = content.splitlines()
    new_lines = []
    in_clock_7segment = False

    for line in lines:
        if "- id: clock_7segment" in line:
            in_clock_7segment = True
        elif "- id: " in line:
            in_clock_7segment = False

        if in_clock_7segment:
            # Replace FG with fg_color if it appears as a standalone word
            # Specifically in strftime calls which look like:
            # it.strftime(cx, date_y, id(font_big_date), FG, TextAlign::CENTER, "%a, %d %b", now);

            if "strftime" in line and "FG" in line:
                line = re.sub(r"\bFG\b", "fg_color", line)

        new_lines.append(line)

    content = "\n".join(new_lines) + "\n"

    # 2. Check for clock_top definition
    # Ensure "const int clock_top =" is present.
    if "const int clock_top =" not in content:
        print("Warning: clock_top declaration not found!")
    else:
        print("clock_top declaration found.")

    with open(CONFIG_FILE, "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
