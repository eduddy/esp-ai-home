import re

CONFIG_FILE = "waveshare.yaml"

def main():
    with open(CONFIG_FILE, "r") as f:
        content = f.read()

    # 1. Fix Colors
    # Replacements:
    # Color::GREEN -> Color(0, 255, 0)
    # Color::GREY -> Color(128, 128, 128)
    # Color::YELLOW -> Color(255, 255, 0)
    # Color::WHITE -> Color(255, 255, 255) # Although WHITE is likely standard, the user might have used it. The user's config has Color::WHITE which is standard.
    # The user errors were GREEN, GREY, YELLOW.
    # The config also uses Color(20, 20, 20) etc.

    # We will define these replacements
    replacements = {
        "Color::GREEN": "Color(0, 255, 0)",
        "Color::GREY": "Color(128, 128, 128)",
        "Color::YELLOW": "Color(255, 255, 0)",
        # Just in case
        "Color::RED": "Color(255, 0, 0)",
        "Color::BLUE": "Color(0, 0, 255)",
    }

    for old, new in replacements.items():
        content = content.replace(old, new)

    # 2. Fix Select Deprecations
    # id(wake_word_engine_location).state -> id(wake_word_engine_location).current_option()
    # id(clock_style).state -> id(clock_style).current_option()
    # id(clock_wallpaper_image).state -> id(clock_wallpaper_image).current_option()

    # Regex to handle whitespace
    select_ids = ["wake_word_engine_location", "clock_style", "clock_wallpaper_image"]
    for sid in select_ids:
        pattern = f"id\\({sid}\\)\\.state"
        replacement = f"id({sid}).current_option()"
        content = re.sub(pattern, replacement, content)

    # 3. Fix Touch Logic
    # 3a. Add global last_touch_x
    if "globals:" in content:
        # We append to the globals list
        global_block = """  - id: last_touch_x
    type: int
    restore_value: no
    initial_value: "0"
"""
        # Find the end of the globals section. It usually ends before "font:" or other top level keys.
        # But simply replacing "globals:" with "globals:\n" + global_block is safer if we know the structure.
        # However, YAML structure is strict.
        # Let's search for "globals:\n" and insert after.
        content = content.replace("globals: \n", "globals: \n" + global_block) # Try with space
        content = content.replace("globals:\n", "globals:\n" + global_block)   # Try without space

    # 3b. Update on_touch
    # Original:
    # on_touch:
    #   - lambda: |-
    #       if (touch.x > 0) id(touch_start_x) = touch.x;
    #       id(touch_start_time) = millis();

    # We want to add id(last_touch_x) = touch.x;
    # Using simple string replace for the specific block

    on_touch_orig = """    on_touch:
      - lambda: |-
          if (touch.x > 0) id(touch_start_x) = touch.x;
          id(touch_start_time) = millis();"""

    on_touch_new = """    on_touch:
      - lambda: |-
          if (touch.x > 0) id(touch_start_x) = touch.x;
          id(touch_start_time) = millis();
          id(last_touch_x) = touch.x;"""

    # Try normalized spacing replacement
    # Read file line by line might be safer to find the block?
    # Let's just try replace. If it fails (due to whitespace mismatch), I'll use regex.

    # Actually, I'll use a specific regex for on_touch block
    # Note: The original file has spaces at end of lines potentially.

    on_touch_pattern = r"(on_touch:\s*\n\s*- lambda: \|-\s*\n\s*if \(touch\.x > 0\) id\(touch_start_x\) = touch\.x;\s*\n\s*id\(touch_start_time\) = millis\(\);)"
    on_touch_repl = r"\1\n          id(last_touch_x) = touch.x;"

    content = re.sub(on_touch_pattern, on_touch_repl, content)

    # 3c. Update on_release
    # Replace touch.x with id(last_touch_x) in on_release

    on_release_pattern = r"(on_release:\s*\n\s*- lambda: \|-\s*\n\s*int delta = abs\(id\(touch_start_x\) - )touch\.x\);"
    on_release_repl = r"\1id(last_touch_x));"

    content = re.sub(on_release_pattern, on_release_repl, content)

    # 3d. Add on_update to touchscreen
    # We can insert it before on_release
    on_release_search = "    on_release: "
    on_update_block = """    on_update:
      - lambda: |-
           if (!touches.empty()) {
             id(last_touch_x) = touches.begin()->x;
           }
"""
    content = content.replace(on_release_search, on_update_block + on_release_search)

    # Write back
    with open(CONFIG_FILE, "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
