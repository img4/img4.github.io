import json
import base36
import base64
import os
import shutil
import time

def process_files():
    start_time = time.time()
    images_root = "images"
    # Temporary folder for Pagefind to scan
    temp_html_dir = "temp_search_html"
    
    if os.path.exists(temp_html_dir):
        shutil.rmtree(temp_html_dir)
    os.makedirs(temp_html_dir)

    print(f"--- Step 1: Generating Shadow HTML ---", flush=True)
    
    count = 0
    max_id = 0
    # Faster walker
    for root, dirs, files in os.walk(images_root):
        for file in files:
            try:
                base36_name = file.lower()
                high_id = base36.loads(base36_name)
                max_id = max(max_id, high_id)
                
                with open(os.path.join(root, file), "r") as f:
                    data = json.load(f)
                    p_value = data.get("p")
                    if p_value:
                        decoded_p = base64.b64decode(p_value).decode('utf-8')
                        
                        # Create a tiny HTML file for Pagefind to "discover"
                        # We put the ID in the filename and the prompt in the body
                        html_path = os.path.join(temp_html_dir, f"{base36_name}.html")
                        with open(html_path, "w", encoding="utf-8") as h:
                            # Pagefind treats the <title> as the result title
                            h.write(f'<html><head><meta charset="utf-8"><title>{decoded_p}</title></head><body>{decoded_p}</body></html>')
                        count += 1
            except:
                continue
    
    print(f"Generated {count} shadow files in {round(time.time() - start_time, 2)}s", flush=True)
    
    # Generate high_id with highest ID
    with open("high_id", "w") as f:
        f.write(str(max_id))

if __name__ == "__main__":
    process_files()