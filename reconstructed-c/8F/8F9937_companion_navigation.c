/*
 * Routine: $8F9937 (companion_navigation)
 * Bank: $8F (ROM Offset: $0F9937)
 * Source: docs/disassembly/entities/companion-navigation.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>

#define WAYPOINT_STRIDE_BYTES   3
#define PROXIMITY_THRESHOLD_PX  2
#define WAYPOINT_QUEUE_SENTINEL 0xFFFF

typedef struct {
    int16_t  world_x;            // $7E:001A
    int16_t  world_y;            // $7E:001C
    uint16_t collision_layer;    // $7E:0017
    uint16_t metatile_prop;      // $7E:0062
} EntityState;

typedef struct {
    uint16_t waypoint_anchor;    // $7E:3C01,x
    uint16_t waypoint_tail;      // $7E:3BFF,x
    uint16_t waypoint_count;     // $7E:3C10,x
    uint16_t target_layer;       // $7E:3BCA,x
    uint16_t target_metatile;    // $7E:3BC9,x
    uint16_t latched_obstacle;   // $7E:3BFC,x
    uint16_t nav_flags;          // $7E:3C12,x (bit 4 arrival, bit 5 lock, bit 12 sticky)
    int16_t  target_x;           // $7E:3C06,x
    int16_t  target_y;           // $7E:3C08,x
    int16_t  sub_target_x;       // $7E:3C03,x
    int16_t  sub_target_y;       // $7E:3C05,x
    uint16_t heading_direction;  // $7E:3C0E,x
    uint16_t sub_heading;        // $7E:3C0C,x
} CompanionNavState;

typedef struct {
    int16_t  x;
    int16_t  y;
    uint8_t  layer;
} BreadcrumbWaypoint;

extern CompanionNavState g_companion_nav;
extern BreadcrumbWaypoint g_waypoint_history[256];

extern uint8_t entity_compute_angle_between(int16_t x1, int16_t y1, int16_t x2, int16_t y2); // $8F:AA51
extern void integrate_companion_velocity_step(void); // $8F:9E49

/**
 * Initializes follower navigation anchor, queue tail, and copies leader layer.
 * Corresponds to $8F:9937.
 */
void companion_waypoint_anchor_init(const EntityState *leader, uint16_t companion_slot) {
    g_companion_nav.waypoint_anchor = companion_slot;
    g_companion_nav.waypoint_tail = companion_slot + WAYPOINT_STRIDE_BYTES;
    g_companion_nav.waypoint_count = 0;

    // Synchronize terrain plane and metatile properties with leader
    g_companion_nav.target_layer = leader->collision_layer;
    g_companion_nav.target_metatile = leader->metatile_prop;

    // Clear obstacle descriptor
    g_companion_nav.latched_obstacle = WAYPOINT_QUEUE_SENTINEL;

    // Retain bit 12 (sticky leash mode), clear arrival/lock bits
    g_companion_nav.nav_flags &= 0x1000;

    // Poll proximity immediately
    companion_waypoint_history_poll(leader, companion_slot);
}

/* companion_waypoint_history_poll: exact to the ROM in 8FA723_companion_waypoint_history_poll.c */

/**
 * Steps companion along recorded breadcrumbs, updating directional headings.
 * Corresponds to $8F:9967.
 */
void companion_breadcrumb_advance_step(EntityState *companion) {
    while (true) {
        // Check if queue has more waypoints
        if (g_companion_nav.waypoint_anchor >= g_companion_nav.waypoint_tail) {
            g_companion_nav.waypoint_count = WAYPOINT_QUEUE_SENTINEL;
            return; // All breadcrumbs consumed
        }

        uint16_t anchor_idx = g_companion_nav.waypoint_anchor / WAYPOINT_STRIDE_BYTES;
        BreadcrumbWaypoint wp = g_waypoint_history[anchor_idx];

        g_companion_nav.target_x = wp.x;
        g_companion_nav.target_y = wp.y;

        // Compute 16-direction angle from companion to waypoint
        uint8_t raw_angle = entity_compute_angle_between(companion->world_x, companion->world_y, wp.x, wp.y);

        // Invert heading by 180 degrees (8 steps in 16-direction system)
        g_companion_nav.heading_direction = (raw_angle ^ 0x08) & 0x0F;

        // Advance anchor in circular FIFO
        g_companion_nav.waypoint_anchor += WAYPOINT_STRIDE_BYTES;

        // Integrate movement physics step towards waypoint
        integrate_companion_velocity_step();

        // Check if companion reached waypoint
        if (abs(companion->world_x - wp.x) <= PROXIMITY_THRESHOLD_PX &&
            abs(companion->world_y - wp.y) <= PROXIMITY_THRESHOLD_PX) {
            break; // Proceed to next breadcrumb on subsequent frame
        }
    }
}
