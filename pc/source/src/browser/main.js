"use strict";

(function()
{
    /** @const */
    var ON_LOCALHOST = !location.hostname.endsWith("copy.sh");

    /** @const */
    var HOST = ON_LOCALHOST ? "" : "//i.copy.sh/";

    /** @const */
    var ON_HTTPS = location.protocol === "https:";

    /** @const */
    var OTHER_HOST = ON_LOCALHOST ? "" : ON_HTTPS ? "//j.copy.sh:8443/" : "//j.copy.sh:8880/";

    /**
     * @return {Object.<string, string>}
     */
    function get_query_arguments()
    {
        var query = location.search.substr(1).split("&");
        var parameters = {};

        for(var i = 0; i < query.length; i++)
        {
            var param = query[i].split("=");
            parameters[param[0]] = decodeURIComponent(param[1]);
        }

        return parameters;
    }

    function chr_repeat(chr, count)
    {
        var result = "";

        while(count-- > 0)
        {
            result += chr;
        }

        return result;
    }

    var progress_ticks = 0;

    function show_progress(e)
    {
        var el = $("loading");
        el.style.display = "block";

        if(e.file_index === e.file_count - 1 && e.loaded >= e.total - 2048)
        {
            // last file is (almost) loaded
            el.textContent = "Starting now ...";
            return;
        }

        var line = "";

        if(e.total && typeof e.loaded === "number")
        {
            var per100 = Math.floor(e.loaded / e.total * 100);
            per100 = Math.min(100, Math.max(0, per100));

            var per50 = Math.floor(per100 / 2);

            line += per100 + "% [";
            line += chr_repeat("#", per50);
            line += chr_repeat(" ", 50 - per50) + "]";
        }
        else
        {
            line += chr_repeat(".", progress_ticks++ % 50);
        }

        el.textContent = line;
    }

    function $(id)
    {
        var el = document.getElementById(id);

        if(!el)
        {
            dbg_log("Element with id `" + id + "` not found");
        }

        return el;
    }

    function onload()
    {
        if(!("responseType" in new XMLHttpRequest))
        {
            alert("Your browser is not supported " +
                  "because it doesn't have XMLHttpRequest.responseType");
            return;
        }

        var settings = {};
		settings.fda = {
			"size": 1474560,
			"url": "dos.img",
			"async": true,
		};
        $("start_emulation").onclick = function()
        {
            $("boot_options").style.display = "none";
            set_profile("custom");

            var images = [];
			
            var hd_file = $("hd_image").files[0];
            if(hd_file)
            {
                settings.hda = { buffer: hd_file };
				start_emulation(settings);
            }
			else{
				alert("Select Project File");
				location.href="index.html";
			}
		};

        var oses = [
            {
                id: "qbasic",
                fda: {
                    "url": HOST + "dos.img",
                    "size": 1474560,
                },
				hda: {
                    "url": HOST + "code.img",
                    "size": 15482880,
                },
                name: "QBasic Quick Start",
            },
        ];

        var query_args = get_query_arguments();
        var profile = query_args["profile"];

        if(query_args["use_bochs_bios"])
        {
            settings.use_bochs_bios = true;
        }

        for(var i = 0; i < oses.length; i++)
        {
            var infos = oses[i];

            if(profile === infos.id)
            {
                start_profile(infos);
                return;
            }

            var element = $("start_" + infos.id);

            if(element)
            {
                element.onclick = function(infos, element)
                {
                    set_profile(infos.id);
                    element.blur();

                    start_profile(infos);
                }.bind(this, infos, element);
            }
        }
		query_args["fda.url"]="dos.img";
        if(profile === "custom")
        {
            if(query_args["hda.url"])
            {
                settings.hda = {
                    "size": 15482880,
                    "url": query_args["hda.url"],
                    "async": true,
                };
            }
            settings.fda = {
                "size": 1474560,
                "url": "dos.img",
                "async": true,
            };
			$("boot_options").style.display = "none";
			start_emulation(settings, done);
        }
        function start_profile(infos)
        {
            $("boot_options").style.display = "none";

            settings.filesystem = infos.filesystem;

            if(infos.state)
            {
                $("reset").style.display = "none";
                settings.initial_state = infos.state;
            }

            settings.fda = infos.fda;
            settings.cdrom = infos.cdrom;
            settings.hda = infos.hda;
            settings.multiboot = infos.multiboot;

            settings.memory_size = infos.memory_size;
            settings.vga_memory_size = infos.vga_memory_size;

            settings.id = infos.id;

            if(infos.boot_order !== undefined)
            {
                settings.boot_order = infos.boot_order;
            }

            start_emulation(settings, done);
        }

        function done(emulator)
        {
            if(query_args["c"])
            {
                setTimeout(function()
                {
                    //emulator.serial0_send(query_args["c"] + "\n");
                    emulator.keyboard_send_text(query_args["c"] + "\n");
                }, 25);
            }
        }
    }

    window.addEventListener("load", onload, false);

    // old webkit fires popstate on every load, fuck webkit
    // https://code.google.com/p/chromium/issues/detail?id=63040
    window.addEventListener("load", function()
    {
        setTimeout(function()
        {
            window.addEventListener("popstate", onpopstate);
        }, 0);
    });

    // works in firefox and chromium
    if(document.readyState === "complete")
    {
        onload();
    }

    /** @param {?=} done */
    function start_emulation(settings, done)
    {
        /** @const */
        var MB = 1024 * 1024;

        var memory_size = settings.memory_size;

        if(!memory_size)
        {
            memory_size = parseInt($("memory_size").value, 10) * MB;

            if(!memory_size)
            {
                alert("Invalid memory size - reset to 128MB");
                memory_size = 128 * MB;
            }
        }

        var vga_memory_size = settings.vga_memory_size;

        if(!vga_memory_size)
        {
            vga_memory_size = parseInt($("video_memory_size").value, 10) * MB;

            if(!vga_memory_size)
            {
                alert("Invalid video memory size - reset to 8MB");
                vga_memory_size = 8 * MB;
            }
        }

        if(!settings.fda)
        {
            var floppy_file = $("floppy_image").files[0];
            if(floppy_file)
            {
                settings.fda = { buffer: floppy_file };
            }
        }

        /** @const */
        var BIOSPATH = "bios/";

        if(settings.use_bochs_bios)
        {
            var biosfile = "bochs-bios.bin";
            var vgabiosfile = "bochs-vgabios.bin";
        }
        else
        {
            var biosfile = "seabios.bin";
            var vgabiosfile = "vgabios.bin";
        }

        //var biosfile = "seabios-qemu.bin";
        //var vgabiosfile = "vgabios-qemu.bin";

        var bios;
        var vga_bios;

        // a bios is only needed if the machine is booted
        if(!settings.initial_state)
        {
            bios = {
                "url": BIOSPATH + biosfile,
            };
            vga_bios = {
                "url": BIOSPATH + vgabiosfile,
            };
        }

        var emulator = new V86Starter({
            "memory_size": memory_size,
            "vga_memory_size": vga_memory_size,

            "screen_container": $("screen_container"),

            "boot_order": settings.boot_order || parseInt($("boot_order").value, 16) || 0,

            "network_relay_url": "wss://relay.widgetry.org/",
            //"network_relay_url": "ws://localhost:8001/",

            "bios": bios,
            "vga_bios": vga_bios,

            "fda": settings.fda,
            "hda": settings.hda,
            "cdrom": settings.cdrom,

            "multiboot": settings.multiboot,

            "initial_state": settings.initial_state,
            "filesystem": settings.filesystem || {},

            "autostart": true,
        });

        emulator.add_listener("emulator-ready", function()
        {

            init_ui(settings, emulator);

            done && done(emulator);
        });

        emulator.add_listener("download-progress", function(e)
        {
            show_progress(e);
        });

        emulator.add_listener("download-error", function(e)
        {
            var el = $("loading");
            el.style.display = "block";
            el.textContent = "Loading " + e.file_name + " failed. Check your connection " +
                             "and reload the page to try again.";
        });
    }

    /**
     * @param {Object} settings
     * @param {V86Starter} emulator
     */
    function init_ui(settings, emulator)
    {
        $("boot_options").style.display = "none";
        $("loading").style.display = "none";
        $("runtime_options").style.display = "block";
        $("screen_container").style.display = "block";

        $("run").onclick = function()
        {
            if(emulator.is_running())
            {
                $("run").value = "Run";
                emulator.stop();
            }
            else
            {
                $("run").value = "Pause";
                emulator.run();
            }

            $("run").blur();
        };

        $("exit").onclick = function()
        {
            emulator.stop();
            location.href = location.pathname;
        };


        var last_tick = 0;
        var running_time = 0;
        var last_instr_counter = 0;
        var interval;
        var os_uses_mouse = false;


        emulator.add_listener("emulator-started", function()
        {
            last_tick = Date.now();
        });

        emulator.add_listener("emulator-stopped", function()
        {
            clearInterval(interval);
        });

        emulator.add_listener("9p-read-start", function()
        {
        });
        emulator.add_listener("9p-read-end", function(args)
        {
        });
        emulator.add_listener("9p-write-end", function(args)
        {
        });

        emulator.add_listener("ide-read-start", function()
        {
        });
        emulator.add_listener("ide-read-end", function(args)
        {
        });
        emulator.add_listener("ide-write-end", function(args)
        {
        });

        emulator.add_listener("eth-receive-end", function(args)
        {
        });
        emulator.add_listener("eth-transmit-end", function(args)
        {
        });


        emulator.add_listener("mouse-enable", function(is_enabled)
        {
        });

        emulator.add_listener("screen-set-mode", function(is_graphical)
        {
        });
        emulator.add_listener("screen-set-size-graphical", function(args)
        {
        });


        add_image_download_button(settings.hda, "hda");
        add_image_download_button(settings.hdb, "hdb");
        add_image_download_button(settings.fda, "fda");
        add_image_download_button(settings.fdb, "fdb");
        add_image_download_button(settings.cdrom, "cdrom");

        function add_image_download_button(obj, type)
        {
            var elem = $("get_" + type + "_image");

            if(!obj || obj.size > 100 * 1024 * 1024)
            {
                elem.style.display = "none";
                return;
            }

            elem.onclick = function(e)
            {
                let buffer = emulator.disk_images[type];
                let filename = settings.id + (type === "cdrom" ? ".iso" : ".img");

                if(buffer.get_as_file)
                {
                    var file = buffer.get_as_file(filename);
                    download(file, filename);
                }
                else
                {
                    buffer.get_buffer(function(b)
                    {
                        if(b)
                        {
                            dump_file(b, "code.img");
                        }
                        else
                        {
                            alert("The file could not be loaded. Maybe it's too big?");
                        }
                    });
                }

                elem.blur();
            };
        }


        $("save_state").onclick = function()
        {
            emulator.save_state(function(error, result)
            {
                if(error)
                {
                    console.log(error.stack);
                    console.log("Couldn't save state: ", error);
                }
                else
                {
                    dump_file(result, "qbasic_state.bin");
                }
            });

            $("save_state").blur();
        };

        $("load_state").onclick = function()
        {
            $("load_state_input").click();
            $("load_state").blur();
        };

        $("load_state_input").onchange = function()
        {
            var file = this.files[0];

            if(!file)
            {
                return;
            }

            var was_running = emulator.is_running();

            if(was_running)
            {
                emulator.stop();
            }

            var filereader = new FileReader();
            filereader.onload = function(e)
            {
                try
                {
                    emulator.restore_state(e.target.result);
                }
                catch(err)
                {
                    alert("Something bad happened while restoring the state:\n" + err + "\n\n" +
                          "Note that the current configuration must be the same as the original");
                    throw err;
                }

                if(was_running)
                {
                    emulator.run();
                }
            };
            filereader.readAsArrayBuffer(file);

            this.value = "";
        };

        $("scale").onchange = function()
        {
            var n = parseFloat(this.value);

            if(n || n > 0)
            {
                emulator.screen_set_scale(n, n);
            }
        };

        $("fullscreen").onclick = function()
        {
            emulator.screen_go_fullscreen();
        };
		
		$("save_as_block").onclick = function()
        {
            emulator.keyboard_send_scancodes([
                0x01,

                // break codes
                0x01 | 0x80,
            ]);
        };
		$("lock_mouse").onclick = function()
		{
			emulator.lock_mouse();
			$("lock_mouse").blur();
			
		}
        $("screen_container").onclick = function()
        {
			if(window.getSelection().isCollapsed)
			{
				let phone_keyboard = document.getElementsByClassName("phone_keyboard")[0];
				phone_keyboard.style.top = document.body.scrollTop + 100 + "px";
				phone_keyboard.style.left = document.body.scrollLeft + 100 + "px";
				phone_keyboard.focus();
			}
        };

        const phone_keyboard = document.getElementsByClassName("phone_keyboard")[0];

        phone_keyboard.setAttribute("autocorrect", "off");
        phone_keyboard.setAttribute("autocapitalize", "off");
        phone_keyboard.setAttribute("spellcheck", "false");
        phone_keyboard.tabIndex = 0;

        $("screen_container").addEventListener("mousedown", (e) =>
        {
            phone_keyboard.focus();
        }, false);

        $("take_screenshot").onclick = async function()
        {
			let txt=document.getElementById("screen").innerText;
			await eel.cor_textshot(txt);
            $("take_screenshot").blur();
        };
        window.addEventListener("keydown", ctrl_w_rescue, false);
        window.addEventListener("keyup", ctrl_w_rescue, false);
        window.addEventListener("blur", ctrl_w_rescue, false);

        function ctrl_w_rescue(e)
        {
            if(e.ctrlKey)
            {
                window.onbeforeunload = function()
                {
                    window.onbeforeunload = null;
                    return "CTRL-W cannot be sent to the emulator.";
                };
            }
            else
            {
                window.onbeforeunload = null;
            }
        }
    }

    function onpopstate(e)
    {
        location.reload();
    }

    function set_profile(prof)
    {
        if(window.history.pushState)
        {
            window.history.pushState({ profile: prof }, "", "?profile=" + prof);
        }

    }

})();
