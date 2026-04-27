# ERP System Documentation

Welcome to the ERP System documentation. This directory contains all technical documentation, guides, and references for the system.

## 📂 Documentation Categories

### 🔐 [Team-Based Data Isolation](./team-isolation/)
Complete documentation for the team-based data isolation feature.

**Quick Links:**
- [Quick Start Guide](./team-isolation/QUICK_START.md) - Start here!
- [Testing Guide](./team-isolation/TESTING_GUIDE.md) - How to test
- [Implementation Summary](./team-isolation/IMPLEMENTATION_COMPLETE.md) - What was built
- [Architecture Overview](./team-isolation/TEAM_ISOLATION_SUMMARY.md) - How it works
- [Technical Details](./team-isolation/TEAM_ISOLATION_IMPLEMENTATION.md) - Implementation details

### 📦 [STOX Mobile WMS](./stox/)
Planning and architecture context for the STOX mobile warehouse execution app.

**Quick Links:**
- [Mobile WMS Plan](./stox/STOX_MOBILE_WMS_PLAN.md) - End-to-end STOX architecture and rollout
- [Picking Algorithm Plan](./stox/STOX_PICKING_ALGORITHM_PLAN.md) - Reservation-first picking design
- [STOX README](./stox/README.md) - STOX documentation hub

## 🚀 Quick Start

If you're looking for the team isolation feature:
1. Go to [team-isolation/QUICK_START.md](./team-isolation/QUICK_START.md)
2. Follow the testing steps
3. Update frontend as documented

## 🗂️ Documentation Structure

```
docs/
├── README.md                          # This file
├── stox/                              # STOX mobile WMS planning
│   ├── README.md                      # STOX documentation hub
│   ├── STOX_MOBILE_WMS_PLAN.md        # Mobile architecture and rollout
│   └── STOX_PICKING_ALGORITHM_PLAN.md # Picking rules and task flow
└── team-isolation/                    # Team isolation feature
    ├── README.md                      # Feature overview
    ├── QUICK_START.md                 # Quick start guide
    ├── TESTING_GUIDE.md               # Testing documentation
    ├── IMPLEMENTATION_COMPLETE.md     # Implementation summary
    ├── TEAM_ISOLATION_SUMMARY.md      # Architecture summary
    └── TEAM_ISOLATION_IMPLEMENTATION.md # Technical details
```

## 📋 Recent Updates

**January 2026**
- ✅ Team-based data isolation implemented
- ✅ All backend services updated
- ✅ API endpoint `/teams/my-teams` added
- ✅ Comprehensive documentation created

**April 2026**
- ✅ STOX mobile WMS planning documents added
- ✅ Picking algorithm documented
- ✅ Staff activity tracking requirement documented

## 🔍 Finding Information

**I want to...**
- Test team isolation → [team-isolation/QUICK_START.md](./team-isolation/QUICK_START.md)
- Understand the architecture → [team-isolation/TEAM_ISOLATION_SUMMARY.md](./team-isolation/TEAM_ISOLATION_SUMMARY.md)
- See what was implemented → [team-isolation/IMPLEMENTATION_COMPLETE.md](./team-isolation/IMPLEMENTATION_COMPLETE.md)
- Run comprehensive tests → [team-isolation/TESTING_GUIDE.md](./team-isolation/TESTING_GUIDE.md)
- Review STOX mobile architecture → [stox/STOX_MOBILE_WMS_PLAN.md](./stox/STOX_MOBILE_WMS_PLAN.md)
- Review STOX picking logic → [stox/STOX_PICKING_ALGORITHM_PLAN.md](./stox/STOX_PICKING_ALGORITHM_PLAN.md)

## 🆘 Getting Help

1. Check the relevant documentation section
2. Review troubleshooting guides
3. Check API logs
4. Verify database state

---

For more information about specific features, navigate to the appropriate subdirectory.
