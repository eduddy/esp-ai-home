import re

CONFIG_FILE = "waveshare.yaml"

def main():
    with open(CONFIG_FILE, "r") as f:
        content = f.read()

    # The previous script fixed the first usage, but missed the second one inside the if condition.
    # We need to find `if (touch.x > id(touch_start_x))` and replace `touch.x` with `id(last_touch_x)`.

    # We can be safe and replace `touch.x` with `id(last_touch_x)` ONLY inside the on_release block.
    # But finding the block boundaries with regex is hard.
    # However, `touch.x` is valid in `on_touch`.
    # `touch.x` is INVALID in `on_release`.

    # So we should only replace `touch.x` where it appears in `on_release`.

    # Let's locate the on_release block again.
    # Since I already modified the file, the content is slightly different.

    # Current state of on_release in file:
    #     on_release:
    #       - lambda: |-
    #           int delta = abs(id(touch_start_x) - id(last_touch_x));
    #           int duration = millis() - id(touch_start_time);
    #
    #           if (delta > 50) {
    #              // Swipe
    #              if (touch.x > id(touch_start_x)) {

    # So I can search for "if (touch.x > id(touch_start_x))" and replace it.

    pattern = r"if \(touch\.x > id\(touch_start_x\)\)"
    replacement = r"if (id(last_touch_x) > id(touch_start_x))"

    new_content = re.sub(pattern, replacement, content)

    if new_content == content:
        print("Warning: Pattern not found!")
    else:
        print("Fixed remaining touch.x usage.")

    with open(CONFIG_FILE, "w") as f:
        f.write(new_content)

if __name__ == "__main__":
    main()
