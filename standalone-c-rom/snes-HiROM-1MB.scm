(define memories
        '((memory DirectPage
                (address (#x0 . #xff))
                (type RAM)
                (section registers ztiny tiny))
        (memory LoRAM
                (address (#x100 . #x1fff))
                (type RAM)
                (qualifier near)
                (section stack data znear near))
        (memory HiRAM
                (address (#x7e2000 . #x7fffff))
                (type RAM)
                (qualifier far)
                (section heap zfar far huge))

        (memory LoROM
                (address (#x8000 . #xffaf))
                (type ROM)
                (qualifier near)
                (scatter-to LoROM-store)
                (section code compactcode cdata cnear switch itiny idata inear data_init_table))

        (memory HeaderExtended
                (address (#xffb0 . #xffbf))
                (type ROM)
                (qualifier near)
                (section snesheaderextended)
                (scatter-to HeaderExt-store))

        (memory HeaderBasic
                (address (#xffc0 . #xffdf))
                (type ROM)
                (qualifier near)
                (section snesheader)
                (scatter-to Header-store))

        (memory Vector
                (address (#xffe0 . #xffff))
                (type ROM)
                (qualifier near)
                (scatter-to Vector-store)
                (section (reset #xfffc)))

        (memory HiROM-c0
                (address (#xc00000 . #xc0ffff))
                (type ROM)
                (qualifier far)
                (section farcode cdata cnear cfar chuge switch ifar ihuge (LoROM-store #xc08000) (HeaderExt-store #xc0ffb0) (Header-store #xc0ffc0) (Vector-store #xc0ffe0)))

        (memory HiROM
                (address (#xc10000 . #xcfffff))
                (type ROM)
                (qualifier far)
                (section farcode cdata cnear cfar chuge switch ifar ihuge))

        (base-address _DirectPageStart DirectPage 0)
        (base-address _NearBaseAddress LoRAM 0)
    ))
